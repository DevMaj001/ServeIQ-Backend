import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { Business } from '../../business/entities/business.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => req?.cookies?.access_token || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
    // One user load serves everything below: deactivation check, token
    // versions, and the PBAC roleEntity.
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: payload.sub },
      relations: { roleEntity: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // Deactivated staff keep no access, whatever their token says.
    if (user.is_active === false) {
      throw new UnauthorizedException('Account deactivated');
    }

    if (
      payload.pin_token_version !== undefined &&
      user.pin_token_version !== payload.pin_token_version
    ) {
      throw new UnauthorizedException('Token invalidated — PIN has been reset');
    }

    let branch: Branch | null = null;
    if (user.branch_id) {
      branch = await this.dataSource
        .getRepository(Branch)
        .findOne({ where: { id: user.branch_id } });
    }

    if (payload.staff_token_version !== undefined) {
      if (
        !branch ||
        branch.staff_token_version !== payload.staff_token_version
      ) {
        throw new UnauthorizedException(
          'Token invalidated — staff session expired',
        );
      }
    }

    // Suspension bites at request time: an is_active=false branch or
    // business cuts every token immediately, not at token expiry.
    if (branch && branch.is_active === false) {
      throw new UnauthorizedException('This branch has been suspended');
    }
    if (user.business_id) {
      const business = await this.dataSource
        .getRepository(Business)
        .findOne({ where: { id: user.business_id } });
      if (business && business.is_active === false) {
        throw new UnauthorizedException('This business has been suspended');
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      role_id: payload.role_id,
      roleEntity: user.roleEntity
        ? { id: user.roleEntity.id, name: user.roleEntity.name }
        : undefined,
      businessId: payload.businessId || payload.business_id,
      branchId: payload.branchId || payload.branch_id,
      // Surfaced so audit trails and downstream checks can tell an
      // impersonated session from the real owner.
      ...(payload.impersonating
        ? { impersonating: true, impersonatorId: payload.impersonator_id }
        : {}),
    };
  }
}
