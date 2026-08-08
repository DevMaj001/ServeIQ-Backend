import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Branch } from '../../branch/entities/branch.entity';

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
    if (
      payload.pin_token_version !== undefined ||
      payload.staff_token_version !== undefined
    ) {
      const user = await this.dataSource
        .getRepository(User)
        .findOne({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException('User not found');

      if (
        payload.pin_token_version !== undefined &&
        user.pin_token_version !== payload.pin_token_version
      ) {
        throw new UnauthorizedException(
          'Token invalidated — PIN has been reset',
        );
      }

      if (payload.staff_token_version !== undefined) {
        const branch = await this.dataSource
          .getRepository(Branch)
          .findOne({ where: { id: user.branch_id } });
        if (
          !branch ||
          branch.staff_token_version !== payload.staff_token_version
        ) {
          throw new UnauthorizedException(
            'Token invalidated — staff session expired',
          );
        }
      }
    }

    // Load roleEntity for PBAC
    const userRepo = this.dataSource.getRepository(User);
    const userWithRole = await userRepo.findOne({
      where: { id: payload.sub },
      relations: { roleEntity: true },
    });

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      role_id: payload.role_id,
      roleEntity: userWithRole?.roleEntity
        ? { id: userWithRole.roleEntity.id, name: userWithRole.roleEntity.name }
        : undefined,
      businessId: payload.businessId || payload.business_id,
      branchId: payload.branchId || payload.branch_id,
    };
  }
}
