/**
 * 고용 모델 Strategy. docs/04 §3.4 · docs/02 §4.2.
 *
 * `engagements.model`이 고용 형태를 결정한다. **전역 설정이나 조직 단위가 아니다** —
 * 전환기에 직접고용과 중개가 병존해야 하고 지역·트랙별로 다를 수 있기 때문이다.
 *
 * 나머지 코드는 이 인터페이스만 안다. `if (model === 'DIRECT_EMPLOYMENT')` 분기를
 * 서비스 로직에 흩뿌리는 순간 전환 가능성이 사라진다 (§5.7).
 *
 * 경계 규칙: 기관 청구(billing_lines) 계산은 모델과 무관하다. 모델별로 달라지는 것은
 * 인력 지급(payout_lines), 계약 서류, 세무 처리, 컴플라이언스뿐이다.
 * 이 경계를 지키면 전환 비용이 정산 모듈 일부로 국한된다.
 */
export type EngagementModel = 'DIRECT_EMPLOYMENT' | 'DELEGATION' | 'BROKERAGE';
export type TaxTreatment = 'WAGE_INCOME' | 'BUSINESS_INCOME' | 'NONE';

export interface DocumentSpec {
  code: string;
  labelKey: string;
  mandatory: boolean;
}

export interface ComplianceCheck {
  code: string;
  labelKey: string;
  /** 이 체크가 통과하지 않으면 ACTIVE로 전이할 수 없는가. */
  blocking: boolean;
}

export interface WorkRecord {
  id: string;
  engagementId: string;
  workDate: Date;
  regularMinutes: number;
  nightMinutes: number;
  overtimeMinutes: number;
  holidayMinutes: number;
}

export interface EngagementContext {
  engagementId: string;
  trackCode: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface PayoutLine {
  engagementId: string;
  lineType: string;
  amount: number;
  quantity: number;
  note: string | null;
}

export interface EngagementStrategy {
  readonly model: EngagementModel;

  /** 계약 체결 시 필요한 서류 목록 */
  requiredContractDocuments(): DocumentSpec[];

  /** 배치 전 통과해야 하는 컴플라이언스 체크 */
  complianceChecks(): ComplianceCheck[];

  /** 근무 기록 → 인력 지급액. BROKERAGE는 빈 배열을 반환한다. */
  calculatePayout(records: WorkRecord[], ctx: EngagementContext): PayoutLine[];

  /** 세무 처리 구분 */
  taxTreatment(): TaxTreatment;

  /** 이 모델에서 플랫폼이 수취하는 수익의 형태 */
  revenueRecognition(): 'GROSS' | 'NET';
}
