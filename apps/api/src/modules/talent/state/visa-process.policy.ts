import type { VisaEligibility } from '../../tracks/tracks.types';

/**
 * 누구에게 체류자격 절차 축이 붙는가.
 *
 * 국적으로 판정하지 않는다 (docs/07 §2.2 · CLAUDE.md §5.10).
 * track_visa_eligibility 조회 결과와 후보자의 현재 소재만 본다.
 */
export interface VisaProcessApplicability {
  /** 이 축을 화면에 노출할지. false면 SCR-102에 체류자격 절차 섹션 자체가 없다. */
  applicable: boolean;
  /** 입국 단계가 필요한지. 국내 자격 변경 건은 APPROVED에서 끝난다. */
  requiresEntry: boolean;
  /** 목표 체류자격. track_visa_eligibility.target_visa_code. */
  targetVisaCode: string | null;
  reasonKey: string;
}

export function resolveVisaProcess(input: {
  eligibility: VisaEligibility;
  targetVisaCode: string | null;
  /** 후보자가 국내에 체류 중인지. 해외 모집 건이면 false. */
  residesInKorea: boolean;
}): VisaProcessApplicability {
  const { eligibility, targetVisaCode, residesInKorea } = input;

  // 이미 취업 가능한 자격을 가진 국내 인력 — 절차가 없다.
  // 세그먼트 A·B·C(F-4·F-6)가 대부분 여기 해당하고, MVP 초기 공급의 주력이다.
  if (eligibility === 'ALLOWED' && residesInKorea) {
    return { applicable: false, requiresEntry: false, targetVisaCode: null, reasonKey: 'visa.process.notRequired' };
  }

  // 자격 취득이 필요할 뿐 체류자격은 그대로인 경우(예: F-4가 요양보호사 자격 취득).
  // 이건 교육·자격 경로이지 체류자격 절차가 아니다.
  if (eligibility === 'REQUIRES_QUALIFICATION' && residesInKorea) {
    return { applicable: false, requiresEntry: false, targetVisaCode: null, reasonKey: 'visa.process.qualificationOnly' };
  }

  // 국내 자격 변경 (D-10 → E-7-2). 입국 단계가 없다.
  if (eligibility === 'REQUIRES_CONVERSION' && residesInKorea) {
    return { applicable: true, requiresEntry: false, targetVisaCode, reasonKey: 'visa.process.conversion' };
  }

  // 회색 영역은 자동 배정이 차단된 상태다. 절차를 시작하기 전에 사람이 먼저 판정해야 한다.
  if (eligibility === 'PENDING_CONFIRMATION') {
    return { applicable: false, requiresEntry: false, targetVisaCode: null, reasonKey: 'visa.process.pendingConfirmation' };
  }

  if (eligibility === 'NOT_ALLOWED') {
    return { applicable: false, requiresEntry: false, targetVisaCode: null, reasonKey: 'visa.process.notAllowed' };
  }

  // 해외 모집 건 — 신규 발급 + 입국.
  return { applicable: true, requiresEntry: true, targetVisaCode, reasonKey: 'visa.process.overseas' };
}
