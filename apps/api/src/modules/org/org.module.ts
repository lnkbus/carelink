import { Global, Module } from '@nestjs/common';
import { OrganizationController } from './controller/organization.controller';
import { OrganizationRepository } from './repository/organization.repository';
import { OrganizationService } from './service/organization.service';

/**
 * org — 기관, 기관 사용자, 검증, 계약 (docs/02 §4).
 * matching이 검증 게이트를 물어보므로 @Global로 노출한다.
 */
@Global()
@Module({
  controllers: [OrganizationController],
  providers: [OrganizationRepository, OrganizationService],
  exports: [OrganizationService],
})
export class OrgModule {}
