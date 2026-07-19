import { Inject, Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DataSource, MoreThan, In } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Business } from '../business/entities/business.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Subscription } from '../subscription/entities/subscription.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { VerificationToken } from '../../entities/verification-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { WaiterLoginDto } from './dto/waiter-login.dto';
import { UserRole } from '../../common/shared';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @Inject(DataSource)
    private dataSource: DataSource,
    private auditService: AuditService,
    private subscriptionService: SubscriptionService,
  ) {}

  async register(dto: RegisterDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Business
      const business = queryRunner.manager.create(Business, {
        name: dto.businessName,
        slug: dto.businessName.toLowerCase().replace(/ /g, '-'),
        type: dto.businessType,
        owner_id: null,
        email: dto.email,
        logo_url: dto.logoUrl ?? null,
        cac_document_url: dto.cacDocumentUrl ?? null,
      } as Partial<Business>);
      const savedBusiness = await queryRunner.manager.save(business);

      // 2. Create Default Branch
      const branch = queryRunner.manager.create(Branch, {
        business_id: savedBusiness.id,
        name: 'Main Branch',
        is_active: true,
      });
      const savedBranch = await queryRunner.manager.save(branch);

      // 2b. Create Trial Subscription
      await this.subscriptionService.createTrialSubscription(savedBranch.id, queryRunner.manager);

      // 3. Create Owner User
      const salt = await bcrypt.genSalt();
      const passwordHash = await bcrypt.hash(dto.password, salt);

      const user = queryRunner.manager.create(User, {
        business_id: savedBusiness.id,
        branch_id: savedBranch.id,
        full_name: dto.fullName,
        email: dto.email,
        password_hash: passwordHash,
        role: UserRole.OWNER,
        is_active: true,
      });
      const savedUser = await queryRunner.manager.save(user);

      // 4. Update Business with Owner ID
      savedBusiness.owner_id = savedUser.id;
      await queryRunner.manager.save(savedBusiness);

      await queryRunner.commitTransaction();

      await this.auditService.log({
        branchId: savedBranch.id,
        userId: savedUser.id,
        action: 'REGISTER',
        entityType: 'Business',
        entityId: savedBusiness.id,
        payload: { businessName: savedBusiness.name, email: savedUser.email },
      });

      return this.generateTokens(savedUser);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err.code === '23505') {
        throw new ConflictException('Email already exists');
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async login(dto: LoginDto) {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { email: dto.email },
    });

    if (user && (await bcrypt.compare(dto.password, user.password_hash))) {
      await this.auditService.log({
        branchId: user.branch_id,
        userId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
        payload: { email: user.email, role: user.role },
      });
      return this.generateTokens(user);
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  async waiterLogin(dto: WaiterLoginDto) {
    if (!dto.pin) {
      throw new BadRequestException('PIN or passcode is required');
    }

    const whereClause: any = {
      role: In([UserRole.WAITER, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.CHEF]),
      is_active: true,
    };

    if (dto.branchId && dto.branchId.length === 36) {
      whereClause.branch_id = dto.branchId;
    }

    const users = await this.dataSource.getRepository(User).find({
      where: whereClause,
    });

    for (const user of users) {
      if (user.pin_hash && (await bcrypt.compare(dto.pin, user.pin_hash))) {
        return this.generateTokens(user);
      }
    }

    throw new UnauthorizedException('Invalid PIN');
  }

  async activate(dto: { email: string; password: string }) {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password_hash) {
      throw new BadRequestException('Account has no password set. Contact your admin.');
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      user.is_active = true;
      await this.dataSource.getRepository(User).save(user);
    }

    return this.generateTokens(user);
  }

  private async generateRefreshToken(userId: string): Promise<string | null> {
    try {
      const repo = this.dataSource.getRepository(RefreshToken);
      const token = crypto.randomBytes(48).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const refreshToken = repo.create({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      await repo.save(refreshToken);

      return token;
    } catch {
      return null;
    }
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      role_id: user.role_id,
      businessId: user.business_id,
      branchId: user.branch_id,
    };

    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        role_id: user.role_id,
        fullName: user.full_name,
        business: user.business_id,
        branch: user.branch_id,
      },
    };
  }

  async refreshToken(refreshTokenStr: string) {
    const repo = this.dataSource.getRepository(RefreshToken);
    const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');

    let stored: RefreshToken | null = null;
    try {
      stored = await repo.findOne({
        where: { token_hash: tokenHash, is_revoked: false, expires_at: MoreThan(new Date()) },
      });
    } catch {
      throw new BadRequestException('Refresh tokens not available');
    }

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.dataSource.getRepository(User).findOne({ where: { id: stored.user_id } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    stored.is_revoked = true;
    await repo.save(stored);

    return this.generateTokens(user);
  }

  async logout(refreshTokenStr: string) {
    try {
      const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');
      const repo = this.dataSource.getRepository(RefreshToken);
      await repo.update({ token_hash: tokenHash }, { is_revoked: true });
    } catch {
      // table may not exist; skip
    }
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.dataSource.getRepository(User).findOne({ where: { email } });
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    const repo = this.dataSource.getRepository(VerificationToken);
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await repo.save(repo.create({
      user_id: user.id,
      token: tokenHash,
      type: 'password_reset',
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    }));

    return { message: 'If that email exists, a reset link has been sent.', reset_token: token };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const repo = this.dataSource.getRepository(VerificationToken);

    const stored = await repo.findOne({
      where: { token: tokenHash, type: 'password_reset', is_used: false, expires_at: MoreThan(new Date()) },
    });
    if (!stored) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.dataSource.getRepository(User).findOne({ where: { id: stored.user_id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const salt = await bcrypt.genSalt();
    user.password_hash = await bcrypt.hash(newPassword, salt);
    await this.dataSource.getRepository(User).save(user);

    stored.is_used = true;
    await repo.save(stored);

    await this.auditService.log({
      branchId: user.branch_id,
      userId: user.id,
      action: 'PASSWORD_RESET',
      entityType: 'User',
      entityId: user.id,
      payload: { email: user.email },
    });

    return { message: 'Password reset successfully' };
  }

  async setupSuperAdmin(dto: { email: string; password: string; full_name?: string }) {
    const existing = await this.dataSource.getRepository(User).findOne({
      where: { email: dto.email },
    });
    if (existing) {
      return { message: 'Super admin already exists' };
    }

    let business = await this.dataSource.getRepository(Business).findOne({
      where: { slug: 'serveiq-admin' },
    });

    if (!business) {
      business = await this.dataSource.getRepository(Business).save({
        name: 'ServeIQ Admin',
        slug: 'serveiq-admin',
        type: 'restaurant',
        owner_id: 'pending',
        email: 'admin@serveiq.io',
        is_active: true,
      });
    }

    let branch = await this.dataSource.getRepository(Branch).findOne({
      where: { business_id: business.id, name: 'Admin Branch' },
    });

    if (!branch) {
      branch = await this.dataSource.getRepository(Branch).save({
        business_id: business.id,
        name: 'Admin Branch',
        is_active: true,
      });
    }

    let subscription = await this.dataSource.getRepository(Subscription).findOne({
      where: { branch_id: branch.id },
    });

    if (!subscription) {
      await this.subscriptionService.createTrialSubscription(branch.id);
    }

    try {
      await this.dataSource.query(`ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'superadmin'`);
    } catch {
      // column might already be varchar, ignore
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.dataSource.getRepository(User).save({
      business_id: business.id,
      branch_id: branch.id,
      full_name: dto.full_name || 'Super Admin',
      email: dto.email,
      password_hash: passwordHash,
      role: UserRole.SUPERADMIN,
      is_active: true,
    });

    business.owner_id = user.id;
    await this.dataSource.getRepository(Business).save(business);

    return this.generateTokens(user);
  }

  async sendEmailVerification(userId: string) {
    const repo = this.dataSource.getRepository(VerificationToken);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');

    await repo.save(repo.create({
      user_id: userId,
      token: tokenHash,
      type: 'email_verify',
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    }));

    return { message: 'Verification code sent', otp };
  }

  async verifyEmail(userId: string, otp: string) {
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    const repo = this.dataSource.getRepository(VerificationToken);

    const stored = await repo.findOne({
      where: { token: tokenHash, type: 'email_verify', is_used: false, expires_at: MoreThan(new Date()) },
    });
    if (!stored) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.email_verified_at = new Date();
    await this.dataSource.getRepository(User).save(user);

    stored.is_used = true;
    await repo.save(stored);

    return { message: 'Email verified successfully' };
  }
}
