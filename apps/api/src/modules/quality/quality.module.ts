import { Global, Module } from '@nestjs/common';
import { ClearanceController } from './controller/clearance.controller';
import { ClearanceRepository } from './repository/clearance.repository';
import { ClearanceService } from './service/clearance.service';
import { ScopeScanService } from './service/scope-scan.service';

/**
 * quality — 배치 전 클리어런스, 업무범위 게이트, 교대 패턴 (docs/02 §4).
 * matching·engagement가 배치 가능 여부를 물어보므로 @Global로 둔다.
 */
@Global()
@Module({
  controllers: [ClearanceController],
  providers: [ClearanceRepository, ClearanceService, ScopeScanService],
  exports: [ClearanceService, ScopeScanService],
})
export class QualityModule {}
