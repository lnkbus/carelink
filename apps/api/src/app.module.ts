import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './core/config/configuration';
import { DbModule } from './core/db/db.module';
import { QueueModule } from './core/queue/queue.module';
import { StorageModule } from './core/storage/storage.module';
import { DomainExceptionFilter } from './core/errors/domain-exception.filter';
import { ScopeInterceptor } from './core/scope/scope.interceptor';
import { IamModule } from './modules/iam/iam.module';
import { JwtAuthGuard } from './modules/iam/guard/jwt-auth.guard';
import { RolesGuard } from './modules/iam/guard/roles.guard';
import { OpsModule } from './modules/ops/ops.module';
import { TalentModule } from './modules/talent/talent.module';
import { TracksModule } from './modules/tracks/tracks.module';

/**
 * Modular Monolith (docs/02 §1-1). 모듈 경계만 명확히 두고 배포는 하나로 한다.
 *
 * 모듈 11종 — docs/02 §4 표 기준.
 *   WORKFORCE CORE  iam · talent · tracks · org · matching · engagement · ops · payroll
 *   CARE VERTICAL   care
 *   지원            recruiting · quality
 * (문서 §11의 리포 트리는 6종만 그리지만 §4 표가 책임·소유 테이블까지 정의한 쪽이다.)
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DbModule,
    QueueModule,
    StorageModule,
    OpsModule,
    IamModule,
    TracksModule,
    TalentModule,
    // 이후 단계에서 순서대로 붙는다 (docs/02 §12):
    //   OrgModule · MatchingModule
    //   RecruitingModule · QualityModule · EngagementModule
    //   CareModule (V2) · PayrollModule (V3 — U1·U2·U5 해결 전 착수 금지)
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ScopeInterceptor },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
