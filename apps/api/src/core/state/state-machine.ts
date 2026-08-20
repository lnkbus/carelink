import { DomainError } from '../errors/domain-error';

/**
 * 상태머신 기반 클래스. docs/02 §6 / CLAUDE.md §5.3.
 *
 * `if (status === 'X')` 분기를 서비스 로직 여기저기 흩뿌리지 않는다.
 * 전이 규칙을 한 곳에 선언하고, 허용되지 않은 전이는 예외를 던진다.
 * 전이 테스트는 필수다 (docs/02 §13 — "상태머신 전이는 단위 테스트 필수").
 */
export class StateMachine<S extends string> {
  constructor(
    public readonly name: string,
    private readonly transitions: Readonly<Record<S, readonly S[]>>,
    public readonly initial: S,
  ) {}

  /** from에서 갈 수 있는 상태 목록. */
  next(from: S): readonly S[] {
    return this.transitions[from] ?? [];
  }

  can(from: S, to: S): boolean {
    return this.next(from).includes(to);
  }

  /** 허용되지 않으면 COMMON_INVALID_TRANSITION을 던진다. */
  assert(from: S, to: S): void {
    if (!this.can(from, to)) {
      throw new DomainError('COMMON_INVALID_TRANSITION', {
        machine: this.name,
        from,
        to,
        allowed: this.next(from),
      });
    }
  }

  /** 더 이상 나갈 곳이 없는 상태 (종료 상태). */
  isTerminal(state: S): boolean {
    return this.next(state).length === 0;
  }

  get states(): S[] {
    return Object.keys(this.transitions) as S[];
  }
}
