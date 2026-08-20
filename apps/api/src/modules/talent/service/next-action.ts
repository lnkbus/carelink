import type { TrackRequirementRow } from '../../tracks/repository/tracks.repository';
import type { DocumentRow } from '../repository/document.repository';
import type { EnrollmentRow } from '../repository/training.repository';
import type { VisaProcessApplicability } from '../state/visa-process.policy';

/**
 * "지금 뭘 해야 하는가"를 정확히 하나로 좁힌다.
 *
 * SCR-101 notes: "홈의 성패는 지금 뭘 해야 하는가를 한 개만 보여주는 데 있습니다.
 * 할 일을 나열하지 말고 next_action 단일 카드로 강제하세요."
 *
 * 그래서 목록을 반환하지 않는다. 우선순위를 코드에 명시하고 첫 항목만 돌려준다 —
 * 호출부가 고르게 두면 화면마다 다른 것을 보여주게 된다.
 */
export interface NextAction {
  /** 클라이언트가 번역할 키. 백엔드는 문구를 만들지 않는다 (docs/02 §10). */
  code: string;
  /** 이 액션이 향하는 화면. */
  screen: string;
  params: Record<string, unknown>;
  /** 왜 지금 이것인가. 운영자 화면과 디버깅용. */
  reasonKey: string;
}

export interface NextActionInput {
  candidate: {
    name: string | null;
    birthDate: Date | null;
    currentLocation: string | null;
    visaStatusCode: string | null;
    visaExpiresInDays: number | null;
  };
  hasTrack: boolean;
  requirements: TrackRequirementRow[];
  documents: DocumentRow[];
  enrollments: EnrollmentRow[];
  visaProcess: VisaProcessApplicability;
  visaProcessStep: string | null;
}

/**
 * 우선순위. 위쪽이 더 급하다.
 *
 * 1) 체류자격 만료 — 만료 상태로 배치되어 있으면 불법 취업이다 (§5.9).
 *    서류 만료보다 위에 둔다.
 * 2) 반려된 서류 — 이미 낸 것을 다시 내는 일이라 가장 빨리 끝난다.
 * 3) 만료된 필수 서류
 * 4) 트랙 미선택 — 이게 없으면 요구사항 자체가 정해지지 않는다.
 * 5) 미제출 필수 서류
 * 6) 미이수 필수 교육
 * 7) 체류자격 절차 다음 단계 (해당자만)
 * 8) 프로필 미완성
 */
export function resolveNextAction(input: NextActionInput): NextAction | null {
  const { candidate, requirements, documents, enrollments } = input;

  // 1) 체류자격 만료 · 임박
  if (candidate.visaExpiresInDays !== null) {
    if (candidate.visaExpiresInDays < 0) {
      return {
        code: 'action.visa.expired', screen: 'SCR-104',
        params: { daysOverdue: -candidate.visaExpiresInDays },
        reasonKey: 'reason.visa.expiredIsIllegalEmployment',
      };
    }
    if (candidate.visaExpiresInDays <= 60) {
      return {
        code: 'action.visa.renew', screen: 'SCR-104',
        params: { daysLeft: candidate.visaExpiresInDays },
        reasonKey: 'reason.visa.expiringSoon',
      };
    }
  }

  // 요구 순서는 docs/07 §3.1의 검증 순서를 따른다 — 신분 → 범죄경력 → 건강.
  // track_requirements에 순서 컬럼이 없어 알파벳순으로 두면 건강진단서를
  // 신분증보다 먼저 요구하게 된다.
  const DOC_ORDER = ['IDENTITY', 'CRIMINAL_RECORD', 'HEALTH', 'EDUCATION', 'CAREER', 'QUALIFICATION'];
  const requiredDocTypes = requirements
    .filter((r) => r.kind === 'DOCUMENT' && r.is_mandatory)
    .map((r) => r.ref_code)
    .sort((a, b) => {
      const ia = DOC_ORDER.indexOf(a), ib = DOC_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  const latestByType = new Map<string, DocumentRow>();
  for (const doc of documents) {
    const prev = latestByType.get(doc.doc_type);
    if (!prev || doc.created_at > prev.created_at) latestByType.set(doc.doc_type, doc);
  }

  // 2) 반려된 서류
  const rejected = [...latestByType.values()].find((d) => d.status === 'REJECTED');
  if (rejected) {
    return {
      code: 'action.document.resubmit', screen: 'SCR-105',
      params: { documentId: rejected.id, docType: rejected.doc_type, rejectReason: rejected.reject_reason },
      reasonKey: 'reason.document.rejected',
    };
  }

  // 3) 만료된 필수 서류
  const expired = requiredDocTypes
    .map((t) => latestByType.get(t))
    .find((d): d is DocumentRow => d?.status === 'EXPIRED');
  if (expired) {
    return {
      code: 'action.document.renew', screen: 'SCR-105',
      params: { documentId: expired.id, docType: expired.doc_type },
      reasonKey: 'reason.document.expired',
    };
  }

  // 4) 트랙 미선택 — 요구사항이 트랙에서 나오므로 이게 먼저다.
  if (!input.hasTrack) {
    return { code: 'action.track.select', screen: 'SCR-103', params: {}, reasonKey: 'reason.track.notSelected' };
  }

  // 5) 미제출 필수 서류
  const missing = requiredDocTypes.find((t) => {
    const doc = latestByType.get(t);
    return !doc || (doc.status !== 'VERIFIED' && doc.status !== 'UNDER_REVIEW');
  });
  if (missing) {
    return {
      code: 'action.document.upload', screen: 'SCR-105',
      params: { docType: missing },
      reasonKey: 'reason.document.missing',
    };
  }

  // 6) 미이수 필수 교육
  const requiredTraining = requirements.filter((r) => r.kind === 'TRAINING' && r.is_mandatory).map((r) => r.ref_code);
  const completed = new Set(enrollments.filter((e) => e.status === 'COMPLETED').map((e) => e.program_code));
  const pendingTraining = requiredTraining.find((code) => !completed.has(code));
  if (pendingTraining) {
    const inProgress = enrollments.find((e) => e.program_code === pendingTraining);
    return {
      code: inProgress ? 'action.training.continue' : 'action.training.enroll',
      screen: 'SCR-106',
      params: { programCode: pendingTraining, progressRate: inProgress ? Number(inProgress.progress_rate) : 0 },
      reasonKey: 'reason.training.mandatoryIncomplete',
    };
  }

  // 7) 체류자격 절차 (해당자만)
  if (input.visaProcess.applicable) {
    return {
      code: 'action.visaProcess.advance', screen: 'SCR-102',
      params: { currentStep: input.visaProcessStep, targetVisaCode: input.visaProcess.targetVisaCode },
      reasonKey: input.visaProcess.reasonKey,
    };
  }

  // 8) 프로필 미완성 — 위 항목들이 모두 끝난 뒤에야 신경 쓸 일이다.
  const profileGaps = (['name', 'birthDate', 'currentLocation'] as const).filter((k) => !candidate[k]);
  if (profileGaps.length > 0) {
    return {
      code: 'action.profile.complete', screen: 'SCR-104',
      params: { missingFields: profileGaps },
      reasonKey: 'reason.profile.incomplete',
    };
  }

  // 할 일이 없으면 null이다. 화면은 이때 '추천 일자리'를 주 카드로 올린다.
  return null;
}
