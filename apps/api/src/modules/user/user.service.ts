import { Injectable, NotFoundException, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Role } from '../role/entities/role.entity';
import { UserRole } from '../../common/shared';
import { CreateWaiterDto } from './dto/create-waiter.dto';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private auditService: AuditService,
  ) {}

  async create(createDto: any) {
    const user = this.userRepository.create(createDto);
    return this.userRepository.save(user);
  }

  async createWaiter(dto: CreateWaiterDto, businessId: string): Promise<{ waiter: Partial<User>; pin: string }> {
    if (!businessId) {
      console.error('[UserService] businessId missing from request context');
      throw new UnauthorizedException('Business ID is missing. Please re-login.');
    }

    try {
      // 1. Validate branch exists and belongs to this business
      console.log(`[UserService] DEBUG: Creating waiter. Branch: ${dto.branchId}, Business: ${businessId}`);
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dto.branchId)) {
        throw new BadRequestException(`Invalid branch ID format: ${dto.branchId}`);
      }
      if (!uuidRegex.test(businessId)) {
        throw new BadRequestException(`Invalid business ID format: ${businessId}`);
      }

      const branch = await this.branchRepository.findOne({
        where: { id: dto.branchId, business_id: businessId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch not found or does not belong to your business`);
      }

      // 2. Generate a unique 4-digit PIN for this business
      let pin = '';
      let pinIsUnique = false;
      let attempts = 0;

      while (!pinIsUnique && attempts < 10) {
        attempts++;
        pin = String(Math.floor(1000 + Math.random() * 9000));
        const existing = await this.userRepository.find({
          where: { business_id: businessId, is_active: true },
        });
        const pinTaken = await Promise.all(
          existing.map((w) => (w.pin_hash ? bcrypt.compare(pin, w.pin_hash) : Promise.resolve(false))),
        );
        pinIsUnique = !pinTaken.some(Boolean);
      }

      const salt = await bcrypt.genSalt();
      const pinHash = await bcrypt.hash(pin, salt);

      const targetRole = dto.role ?? UserRole.WAITER;

      // Generate a placeholder email if not supplied
      const email = (dto.email && dto.email.trim() !== '') 
        ? dto.email 
        : `staff-${Date.now()}-${Math.floor(Math.random() * 1000)}@internal.serveiq`;

      // Managers/chefs use the admin dashboard (email+password login).
      // Waiters/supervisors use PIN-based login on the POS app.
      const needsPassword = targetRole === UserRole.MANAGER || targetRole === UserRole.CHEF;
      const passwordHash = needsPassword ? pinHash : await bcrypt.hash(Math.random().toString(36), salt);

      // Look up the PBAC Role entity for this user's role
      const roleName = targetRole.charAt(0).toUpperCase() + targetRole.slice(1);
      const pbacRole = await this.roleRepository.findOne({ where: { name: roleName } });

      const user = new User();
      Object.assign(user, {
        business_id: businessId,
        branch_id: dto.branchId,
        full_name: dto.fullName,
        email,
        phone: dto.phone || null,
        avatar_url: dto.avatar_url || null,
        password_hash: passwordHash,
        pin_hash: pinHash,
        role: targetRole as UserRole,
        role_id: pbacRole?.id || null,
        is_active: true,
      });

      const savedUser = await this.userRepository.save(user);

      const auditAction =
        targetRole === UserRole.SUPERVISOR ? 'SUPERVISOR_CREATED' :
        targetRole === UserRole.MANAGER ? 'MANAGER_CREATED' :
        targetRole === UserRole.CHEF ? 'CHEF_CREATED' :
        targetRole === UserRole.CASHIER ? 'CASHIER_CREATED' : 'WAITER_CREATED';
      await this.auditService.log({
        branchId: dto.branchId,
        userId: savedUser.id,
        action: auditAction,
        entityType: 'User',
        entityId: savedUser.id,
        payload: { fullName: savedUser.full_name, email: savedUser.email, role: savedUser.role },
      });

      return {
        waiter: {
          id: savedUser.id,
          full_name: savedUser.full_name,
          email: savedUser.email,
          phone: savedUser.phone,
          avatar_url: savedUser.avatar_url,
          role: savedUser.role,
          role_id: savedUser.role_id,
          branch_id: savedUser.branch_id,
        },
        pin, // Plain PIN — shown once to admin
      };
    } catch (err) {
      console.error('[UserService] Error creating waiter:', err);
      
      // If it's already a Nest exception, just re-throw it
      if (err instanceof NotFoundException || err instanceof BadRequestException || err instanceof UnauthorizedException || err instanceof ConflictException) {
        throw err;
      }

      // Handle potential duplicate email or other DB constraints
      if (err.code === '23505') {
        throw new ConflictException('A staff member with this email or identity already exists.');
      }
      
      // For any other DB error, wrap it in a BadRequestException or re-throw
      throw new BadRequestException('Failed to create user');
    }
  }

  async findAllWaiters(branchId: string, pagination?: { page: number; per_page: number }, roleFilter?: string) {
    const where: any = { branch_id: branchId };
    if (roleFilter === 'all') {
      where.role = In([UserRole.WAITER, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.CHEF, UserRole.CASHIER]);
    } else {
      where.role = UserRole.WAITER;
    }
    const skip = pagination ? (pagination.page - 1) * pagination.per_page : undefined;
    const take = pagination ? pagination.per_page : undefined;

    const [data, total] = await this.userRepository.findAndCount({
      where,
      skip,
      take,
      select: { id: true, full_name: true, email: true, phone: true, avatar_url: true, role: true, is_active: true, created_at: true },
    });
    return { data, total };
  }

  async resetWaiterPin(userId: string, businessId: string): Promise<{ pin: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId, business_id: businessId, role: In([UserRole.WAITER, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.CHEF, UserRole.CASHIER]) },
    });
    if (!user) throw new NotFoundException('Staff member not found');

    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const salt = await bcrypt.genSalt();
    user.pin_hash = await bcrypt.hash(pin, salt);
    user.pin_token_version += 1;
    await this.userRepository.save(user);

    await this.auditService.log({
      branchId: user.branch_id,
      userId: user.id,
      action: 'STAFF_PIN_RESET',
      entityType: 'User',
      entityId: user.id,
      payload: { fullName: user.full_name },
    });

    return { pin };
  }

  async findAllByBranch(branchId: string) {
    return this.userRepository.find({ where: { branch_id: branchId } });
  }

  async findOne(id: string, branchId?: string) {
    const where: any = { id };
    if (branchId) where.branch_id = branchId;
    const user = await this.userRepository.findOne({ where });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async update(id: string, branchId: string, updateDto: any) {
    const user = await this.findOne(id, branchId);
    const allowed = ['full_name', 'phone', 'email', 'is_active'];
    for (const key of Object.keys(updateDto)) {
      if (allowed.includes(key)) {
        (user as any)[key] = updateDto[key];
      }
    }
    if (updateDto.password) {
      const salt = await bcrypt.genSalt();
      user.password_hash = await bcrypt.hash(updateDto.password, salt);
    }
    return this.userRepository.save(user);
  }

  async updateProfile(userId: string, dto: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const changes: any = {};
    if (dto.full_name) {
      changes.full_name = { old: user.full_name, new: dto.full_name };
      user.full_name = dto.full_name;
    }
    if (dto.phone) {
      changes.phone = { old: user.phone, new: dto.phone };
      user.phone = dto.phone;
    }
    if (dto.password) {
      const salt = await bcrypt.genSalt();
      user.password_hash = await bcrypt.hash(dto.password, salt);
      changes.password_changed = true;
    }

    await this.userRepository.save(user);

    if (Object.keys(changes).length > 0) {
      await this.auditService.log({
        branchId: user.branch_id,
        userId: user.id,
        action: 'PROFILE_UPDATED',
        entityType: 'User',
        entityId: user.id,
        payload: changes,
      });
    }

    return user;
  }

  async deactivateUser(id: string, businessId: string) {
    const user = await this.userRepository.findOne({
      where: { id, business_id: businessId },
    });
    if (!user) throw new NotFoundException('User not found or does not belong to your business');
    user.is_active = false;
    await this.userRepository.save(user);

    await this.auditService.log({
      branchId: user.branch_id,
      userId: user.id,
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: user.id,
      payload: { fullName: user.full_name, email: user.email, role: user.role },
    });

    return user;
  }

  async removeUser(id: string, businessId: string) {
    const user = await this.userRepository.findOne({
      where: { id, business_id: businessId },
    });
    if (!user) {
      const existsElsewhere = await this.userRepository.findOne({ where: { id } });
      if (existsElsewhere) {
        throw new NotFoundException('User exists but belongs to a different business');
      }
      throw new NotFoundException('User not found');
    }

    // Prevent deleting the last OWNER in a business
    if (user.role === UserRole.OWNER) {
      const ownerCount = await this.userRepository.count({
        where: { business_id: businessId, role: UserRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot delete the last owner of this business');
      }
    }

    await this.auditService.log({
      branchId: user.branch_id,
      userId: user.id,
      action: user.role === UserRole.SUPERVISOR ? 'SUPERVISOR_DELETED' : 'USER_DELETED',
      entityType: 'User',
      entityId: user.id,
      payload: { fullName: user.full_name, email: user.email, role: user.role },
    });

    return this.userRepository.remove(user);
  }
}
