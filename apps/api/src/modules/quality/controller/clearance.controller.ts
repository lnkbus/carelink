import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  ClearanceDto, ClearanceItemDto, ClearanceQueryDto, RecordClearanceDto, RestrictedFlagDto,
  ScopeScanRequestDto, ScopeScanResultDto, WorkerClearanceSummaryDto,
} from '../dto/clearance.dto';
import type { ClearanceRow, ConsoleClearanceRow } from '../repository/clearance.repository';
import { ClearanceService } from '../service/clearance.service';
import { ScopeScanService } from '../service/scope-scan.service';
import type { ClearanceType } from '../state/clearance.state';

/**
 * SCR-509 품질 · 안전 게이트.
 *
 * 이 화면이 CARELINK가 파는 것의 실체다. 6개 클리어런스가 전부 PASS여야 배치
 * 가능하고, 운영자가 예외 처리할 수 없다 (§5.11 · SCR-509 notes).
 * 여기에 '강제 배치' 버튼을 만들면 나머지 통제 장치가 전부 무의미해진다.
 */
@Controller('admin')
@Roles('ADMIN', 'SUPER_ADMIN')
export class ClearanceController {
  constructor(
    private readonly clearances: ClearanceService,
    private readonly scopeScan: ScopeScanService,
  ) {}

  /** GET /api/v1/admin/clearances?result=&expiring= */
  @Get('clearances')
  async list(@Query() q: ClearanceQueryDto): Promise<ClearanceDto[]> {
    const rows = await this.clearances.listForConsole({
      result: q.result, expiringDays: q.expiring ? Number(q.expiring) : undefined,
    });
    return rows.map(toClearanceDto);
  }

  /** GET /api/v1/admin/workers/{id}/clearances — 6개 항목 + 배치 가능 여부. */
  @Get('workers/:id/clearances')
  async forWorker(@Param('id', ParseUUIDPipe) id: string): Promise<WorkerClearanceSummaryDto> {
    const { rows, readiness } = await this.clearances.workerSummary(id);
    return Object.assign(new WorkerClearanceSummaryDto(), {
      workerUserId: id,
      items: rows.map((r) =>
        Object.assign(new ClearanceItemDto(), {
          clearanceType: r.clearance_type,
          result: r.result,
          recorded: 'id' in r,
          expiresOn: 'expires_on' in r && r.expires_on ? toDateString(r.expires_on) : null,
          id: 'id' in r ? r.id : null,
        }),
      ),
      deployable: readiness.ready,
      missing: readiness.missing,
      expired: readiness.expired,
    });
  }

  /**
   * PATCH /api/v1/admin/clearances/{id} — 사람이 확인한 결과를 기록한다.
   * 시스템은 판정하지 않는다 (§6-1). 전이 규칙은 clearanceMachine이 강제한다.
   */
  @Patch('clearances/:id')
  async record(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordClearanceDto,
  ): Promise<ClearanceDto> {
    const existing = await this.clearances.getById(id);
    const row = await this.clearances.record({
      workerUserId: existing.worker_user_id,
      clearanceType: existing.clearance_type as ClearanceType,
      result: dto.result,
      documentId: dto.documentId ?? null,
      expiresOn: dto.expiresOn ?? null,
      note: dto.note ?? null,
      actorUserId: viewer.userId!,
    });
    return toClearanceDto(row);
  }

  /**
   * POST /api/v1/admin/clearances/workers/{id}/{type} — 첫 기록.
   * 행이 아직 없으면 PATCH할 id도 없으므로 생성 경로가 따로 필요하다.
   */
  @Post('clearances/workers/:workerId/:type')
  async create(
    @CurrentViewer() viewer: Viewer,
    @Param('workerId', ParseUUIDPipe) workerId: string,
    @Param('type') type: string,
    @Body() dto: RecordClearanceDto,
  ): Promise<ClearanceDto> {
    const row = await this.clearances.record({
      workerUserId: workerId,
      clearanceType: type as ClearanceType,
      result: dto.result,
      documentId: dto.documentId ?? null,
      expiresOn: dto.expiresOn ?? null,
      note: dto.note ?? null,
      actorUserId: viewer.userId!,
    });
    return toClearanceDto(row);
  }

  /**
   * POST /api/v1/admin/scope-scan — 자유 입력 미리보기.
   * 감지는 거절이 아니라 검토 트리거다. 결과에 '차단'이 없는 이유다 (§6-15).
   */
  @Post('scope-scan')
  async scan(@Body() dto: ScopeScanRequestDto): Promise<ScopeScanResultDto> {
    const result = await this.scopeScan.scan(dto.text);
    return Object.assign(new ScopeScanResultDto(), result);
  }

  /** GET /api/v1/admin/restricted-flags — 업무범위 감지 건. care(V2)가 채운다. */
  @Get('restricted-flags')
  async flags(): Promise<RestrictedFlagDto[]> {
    const rows = await this.clearances.listRestrictedFlags();
    return rows.map((r) =>
      Object.assign(new RestrictedFlagDto(), {
        careRequestId: r.id, flags: r.restricted_flags, status: r.status,
        createdAt: r.created_at, ward: r.ward,
      }),
    );
  }
}

function toDateString(d: Date | string): string {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

function toClearanceDto(r: ClearanceRow | ConsoleClearanceRow): ClearanceDto {
  const expires = r.expires_on ? toDateString(r.expires_on) : null;
  return Object.assign(new ClearanceDto(), {
    id: r.id,
    workerUserId: r.worker_user_id,
    displayCode: 'display_code' in r ? r.display_code : null,
    clearanceType: r.clearance_type,
    result: r.result,
    expiresOn: expires,
    checkedAt: r.checked_at,
    note: r.note,
    candidateStatus: 'candidate_status' in r ? r.candidate_status : null,
    daysToExpiry: expires === null ? null
      : Math.round((Date.parse(`${expires}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000),
  });
}
