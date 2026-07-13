import { Module } from '@nestjs/common';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../user/entities/user.entity';
import { Business } from '../business/entities/business.entity';
import { Branch } from '../branch/entities/branch.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { AuditService } from '../../common/services/audit.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Business, Branch, AuditLog]),
    ConfigModule,
    PassportModule,
    SubscriptionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'serveiq-secret-2024',
        signOptions: {
          expiresIn: (configService.get('JWT_EXPIRES_IN', '24h') as any),
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    AuditService,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
