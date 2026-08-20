import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controller/auth.controller';
import { ConsentRepository } from './repository/consent.repository';
import { RefreshTokenRepository } from './repository/refresh-token.repository';
import { UserRepository } from './repository/user.repository';
import { AuthService } from './service/auth.service';
import { ConsentService } from './service/consent.service';
import { OtpService } from './service/otp.service';
import { TokenService } from './service/token.service';
import { UserService } from './service/user.service';

/**
 * iam — 인증, 사용자, 역할, 동의 (docs/02 §4).
 * 다른 모듈에는 UserService(getUser·hasRole·getScope)와 TokenService만 노출한다.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    UserRepository, ConsentRepository, RefreshTokenRepository,
    AuthService, UserService, OtpService, TokenService, ConsentService,
  ],
  exports: [UserService, TokenService],
})
export class IamModule {}
