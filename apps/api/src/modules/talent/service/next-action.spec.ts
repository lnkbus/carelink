import { resolveNextAction, type NextActionInput } from './next-action';

function base(over: Partial<NextActionInput> = {}): NextActionInput {
  return {
    candidate: { name: '흐엉', birthDate: new Date('1985-03-11'), currentLocation: '경기 안산', visaStatusCode: 'F-4', visaExpiresInDays: 400 },
    hasTrack: true,
    requirements: [
      { id: '1', track_id: 't', kind: 'DOCUMENT', ref_code: 'IDENTITY', is_mandatory: true, note: null },
      { id: '2', track_id: 't', kind: 'DOCUMENT', ref_code: 'HEALTH', is_mandatory: true, note: null },
      { id: '3', track_id: 't', kind: 'TRAINING', ref_code: 'MANDATORY_BASE', is_mandatory: true, note: null },
    ],
    documents: [],
    enrollments: [],
    visaProcess: { applicable: false, requiresEntry: false, targetVisaCode: null, reasonKey: 'x' },
    visaProcessStep: null,
    ...over,
  };
}

const doc = (type: string, status: string, extra: Record<string, unknown> = {}) =>
  ({ id: `d-${type}`, doc_type: type, status, created_at: new Date('2026-08-01'), reject_reason: null, ...extra }) as never;

describe('resolveNextAction — SCR-101은 할 일을 정확히 하나만 보여준다', () => {
  it('체류자격 만료가 다른 무엇보다 먼저다', () => {
    // 만료된 체류자격으로 배치되어 있으면 불법 취업이다 (§5.9).
    // 서류가 반려돼 있어도 이쪽이 먼저 나와야 한다.
    const a = resolveNextAction(base({
      candidate: { ...base().candidate, visaExpiresInDays: -3 },
      documents: [doc('IDENTITY', 'REJECTED')],
    }));
    expect(a?.code).toBe('action.visa.expired');
    expect(a?.params.daysOverdue).toBe(3);
  });

  it('만료 60일 전부터 갱신을 띄운다', () => {
    const a = resolveNextAction(base({ candidate: { ...base().candidate, visaExpiresInDays: 45 } }));
    expect(a?.code).toBe('action.visa.renew');
    expect(a?.params.daysLeft).toBe(45);
  });

  it('61일 남았으면 아직 띄우지 않는다', () => {
    const a = resolveNextAction(base({
      candidate: { ...base().candidate, visaExpiresInDays: 61 },
      documents: [doc('IDENTITY', 'VERIFIED'), doc('HEALTH', 'VERIFIED')],
      enrollments: [{ program_code: 'MANDATORY_BASE', status: 'COMPLETED' } as never],
    }));
    expect(a).toBeNull();
  });

  it('반려 서류가 미제출 서류보다 먼저다', () => {
    // 이미 낸 것을 다시 내는 일이라 가장 빨리 끝난다.
    const a = resolveNextAction(base({ documents: [doc('IDENTITY', 'REJECTED', { reject_reason: '사본 흐림' })] }));
    expect(a?.code).toBe('action.document.resubmit');
    expect(a?.params.rejectReason).toBe('사본 흐림');
  });

  it('트랙을 고르기 전에는 서류를 요구하지 않는다', () => {
    // 요구 서류가 트랙에서 나오므로 트랙 선택이 먼저다.
    const a = resolveNextAction(base({ hasTrack: false, requirements: [] }));
    expect(a?.code).toBe('action.track.select');
  });

  it('심사 중인 서류는 다시 올리라고 하지 않는다', () => {
    const a = resolveNextAction(base({
      documents: [doc('IDENTITY', 'UNDER_REVIEW'), doc('HEALTH', 'VERIFIED')],
      enrollments: [{ program_code: 'MANDATORY_BASE', status: 'COMPLETED' } as never],
    }));
    expect(a).toBeNull();
  });

  it('신분증을 건강진단서보다 먼저 요구한다', () => {
    // docs/07 §3.1의 검증 순서. track_requirements에 순서 컬럼이 없어
    // 알파벳순으로 두면 HEALTH가 IDENTITY보다 먼저 나온다.
    const a = resolveNextAction(base());
    expect(a?.params.docType).toBe('IDENTITY');
  });

  it('서류가 끝나면 필수 교육으로 넘어간다', () => {
    const a = resolveNextAction(base({ documents: [doc('IDENTITY', 'VERIFIED'), doc('HEALTH', 'VERIFIED')] }));
    expect(a?.code).toBe('action.training.enroll');
    expect(a?.params.programCode).toBe('MANDATORY_BASE');
  });

  it('수강 중이면 이어서 학습으로 바뀐다', () => {
    const a = resolveNextAction(base({
      documents: [doc('IDENTITY', 'VERIFIED'), doc('HEALTH', 'VERIFIED')],
      enrollments: [{ program_code: 'MANDATORY_BASE', status: 'IN_PROGRESS', progress_rate: '68.00' } as never],
    }));
    expect(a?.code).toBe('action.training.continue');
    expect(a?.params.progressRate).toBe(68);
  });

  it('체류자격 절차 대상자만 그 단계를 안내받는다', () => {
    const done = {
      documents: [doc('IDENTITY', 'VERIFIED'), doc('HEALTH', 'VERIFIED')],
      enrollments: [{ program_code: 'MANDATORY_BASE', status: 'COMPLETED' } as never],
    };
    expect(resolveNextAction(base(done))).toBeNull();
    const a = resolveNextAction(base({
      ...done,
      visaProcess: { applicable: true, requiresEntry: false, targetVisaCode: 'E-7-2', reasonKey: 'visa.process.conversion' },
      visaProcessStep: 'DOCUMENT_REVIEW',
    }));
    expect(a?.code).toBe('action.visaProcess.advance');
    expect(a?.params.targetVisaCode).toBe('E-7-2');
  });

  it('프로필 미완성은 가장 나중이다', () => {
    const a = resolveNextAction(base({
      candidate: { ...base().candidate, name: null },
      documents: [doc('IDENTITY', 'VERIFIED'), doc('HEALTH', 'VERIFIED')],
      enrollments: [{ program_code: 'MANDATORY_BASE', status: 'COMPLETED' } as never],
    }));
    expect(a?.code).toBe('action.profile.complete');
    expect(a?.params.missingFields).toEqual(['name']);
  });

  it('할 일이 여러 개여도 반환은 항상 하나다', () => {
    const a = resolveNextAction(base({
      candidate: { name: null, birthDate: null, currentLocation: null, visaStatusCode: null, visaExpiresInDays: 10 },
      hasTrack: false, documents: [doc('IDENTITY', 'REJECTED')], requirements: [],
    }));
    expect(a).not.toBeNull();
    expect(Array.isArray(a)).toBe(false);
  });
});
