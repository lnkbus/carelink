import { RetentionService } from './retention.service';
import type { RetentionPolicyRow, RetentionRepository } from '../repository/retention.repository';
import type { StorageService } from '../../../core/storage/storage.service';

/**
 * 보존기간 자동 파기 (CLAUDE.md §7 · docs/11 §4).
 *
 * 여기서 못 박는 것은 "지우지 않는 경우"입니다. 파기 잡의 사고는 대부분
 * 지워야 할 것을 안 지운 쪽이 아니라 **지우면 안 되는 것을 지운** 쪽입니다.
 */
function policy(over: Partial<RetentionPolicyRow>): RetentionPolicyRow {
  return {
    id: 'p1', data_type: 'DOCUMENT_CRIMINAL', retention_days: 0,
    purge_strategy: 'HARD_DELETE', legal_basis: null, ...over,
  };
}

function makeService(policies: RetentionPolicyRow[], docs: unknown[] = [], users: unknown[] = []) {
  const calls = { purgedDocs: [] as string[], anonymized: [] as string[], deleted: [] as string[] };
  const repo = {
    activePolicies: jest.fn().mockResolvedValue(policies),
    purgeableVerdictDocuments: jest.fn().mockResolvedValue(docs),
    purgeableIdentityDocuments: jest.fn().mockResolvedValue(docs),
    markDocumentPurged: jest.fn(async (id: string) => { calls.purgedDocs.push(id); }),
    anonymizableUsers: jest.fn().mockResolvedValue(users),
    anonymizeUser: jest.fn(async (id: string) => { calls.anonymized.push(id); }),
  } as unknown as RetentionRepository;
  const storage = {
    deleteObject: jest.fn(async (k: string) => { calls.deleted.push(k); return 'NO_STORE' as const; }),
  } as unknown as StorageService;
  const audit = { record: jest.fn() } as never;
  return { svc: new RetentionService(repo, storage, audit), repo, calls };
}

describe('지우지 않는 경우', () => {
  it('ARCHIVE는 아무것도 지우지 않는다', async () => {
    // 근무 기록·감사 로그·동의 기록이 전부 ARCHIVE입니다. 여기서 지우면
    // '아카이브'라는 이름으로 정산 분쟁의 근거가 사라집니다.
    const { svc, calls } = makeService([
      policy({ data_type: 'WORK_RECORD', retention_days: 1095, purge_strategy: 'ARCHIVE' }),
      policy({ data_type: 'AUDIT_LOG', retention_days: 1095, purge_strategy: 'ARCHIVE' }),
    ]);
    const out = await svc.purgeAll();
    expect(calls.purgedDocs).toHaveLength(0);
    expect(calls.anonymized).toHaveLength(0);
    expect(out.every((o) => o.purged === 0 && o.skippedReason !== null)).toBe(true);
  });

  it('보존기간이 NULL이면 영구 보존이다 — 0일과 다르다', async () => {
    // 0일은 '즉시 파기'입니다. NULL을 0으로 취급하면 동의 기록이 매일 지워집니다.
    const { svc, repo } = makeService([
      policy({ data_type: 'CONSENT_RECORD', retention_days: null, purge_strategy: 'ARCHIVE' }),
    ]);
    const out = await svc.purgeAll();
    expect(out[0].skippedReason).toContain('indefinite');
    expect(repo.purgeableVerdictDocuments).not.toHaveBeenCalled();
  });

  it('대응하는 구현이 없는 정책은 건너뛰되 이유를 남긴다', async () => {
    // 조용히 통과시키면 새 정책을 넣고도 아무 일이 일어나지 않는 것을
    // 아무도 모릅니다.
    const { svc } = makeService([
      policy({ data_type: 'PAYROLL', retention_days: 1825, purge_strategy: 'SHRED' }),
    ]);
    const out = await svc.purgeAll();
    expect(out[0].purged).toBe(0);
    expect(out[0].skippedReason).toContain('SHRED');
  });

  it('서류 유형이 매핑되지 않은 HARD_DELETE 정책은 아무것도 지우지 않는다', async () => {
    const { svc, repo } = makeService([
      policy({ data_type: 'DOCUMENT_UNKNOWN', retention_days: 30 }),
    ]);
    const out = await svc.purgeAll();
    expect(out[0].skippedReason).toContain('DOCUMENT_UNKNOWN');
    expect(repo.purgeableVerdictDocuments).not.toHaveBeenCalled();
  });
});

describe('원본 파기', () => {
  const doc = { id: 'd1', candidate_id: 'c1', doc_type: 'CRIMINAL_RECORD', file_key: 'k1', verdict: 'CLEAR' };

  it('행이 아니라 원본만 지운다 — 결과값이 남아야 확인 사실을 증명한다', async () => {
    const { svc, calls } = makeService([policy({})], [doc]);
    const out = await svc.purgeAll();
    expect(calls.deleted).toEqual(['k1']);
    expect(calls.purgedDocs).toEqual(['d1']);
    expect(out[0].purged).toBe(1);
  });

  it('오브젝트 삭제를 확인하지 못하면 그 사실을 보고한다', async () => {
    // 지우지 않았는데 지웠다고 보고하면 파기 대장이 거짓이 되고,
    // 그 대장은 유출 사고 때 유일한 방어 근거입니다.
    const { svc } = makeService([policy({})], [doc]);
    const out = await svc.purgeAll();
    expect(out[0].unconfirmed).toBe(1);
  });

  it('신분 서류는 계약 종료 기준 조회를 쓴다', async () => {
    const { svc, repo } = makeService([
      policy({ data_type: 'DOCUMENT_IDENTITY', retention_days: 365 }),
    ]);
    await svc.purgeAll();
    expect(repo.purgeableIdentityDocuments).toHaveBeenCalled();
    expect(repo.purgeableVerdictDocuments).not.toHaveBeenCalled();
  });
});

describe('탈퇴 사용자 익명화', () => {
  it('행을 지우지 않고 식별자만 무효화한다', async () => {
    // 근무 기록·감사 로그가 이 id를 참조하고 그것들은 파기 대상이 아닙니다.
    const { svc, calls } = makeService(
      [policy({ data_type: 'WITHDRAWN_USER', retention_days: 30, purge_strategy: 'ANONYMIZE' })],
      [],
      [{ id: 'u1', withdrawal_requested_at: new Date('2026-07-01') }],
    );
    const out = await svc.purgeAll();
    expect(calls.anonymized).toEqual(['u1']);
    expect(out[0].purged).toBe(1);
  });

  it('ANONYMIZE 전략이라도 유형이 다르면 처리하지 않는다', async () => {
    const { svc, repo } = makeService([
      policy({ data_type: 'SOMETHING_ELSE', retention_days: 30, purge_strategy: 'ANONYMIZE' }),
    ]);
    const out = await svc.purgeAll();
    expect(out[0].skippedReason).toContain('SOMETHING_ELSE');
    expect(repo.anonymizableUsers).not.toHaveBeenCalled();
  });
});
