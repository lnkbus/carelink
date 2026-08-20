import { StateMachine } from '../../../core/state/state-machine';

/** documents.status — docs/02 §6.2. SCR-105의 서류 상태. */
export type DocumentStatus = 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export const documentMachine = new StateMachine<DocumentStatus>(
  'talent.document',
  {
    PENDING: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['VERIFIED', 'REJECTED'],
    // 반려되면 재제출해서 다시 심사로 들어간다.
    REJECTED: ['UNDER_REVIEW'],
    // 만료는 배치 스케줄러가 expires_at 도달 시 전이시킨다 (docs/02 §6.2).
    VERIFIED: ['EXPIRED'],
    // 만료된 서류는 되살리지 않는다. 새 서류를 올려야 한다 —
    // 같은 행을 재사용하면 어느 발급본으로 검증했는지가 사라진다.
    EXPIRED: [],
  },
  'PENDING',
);

/**
 * 확인 후 원본을 파기해야 하는 서류 (docs/11 §1.2 · §4).
 * 범죄경력·건강진단서는 결과값만 남기고 원본 파일을 지운다.
 * 유출 시 피해 규모가 다른 항목과 비교되지 않는다.
 */
export const PURGE_ORIGINAL_AFTER_REVIEW: readonly string[] = ['CRIMINAL_RECORD', 'HEALTH'];

/** 원본 대신 남기는 결과값. */
export const DOCUMENT_VERDICTS = {
  CRIMINAL_RECORD: ['CLEAR', 'FLAGGED'],
  HEALTH: ['FIT', 'UNFIT'],
} as const;
