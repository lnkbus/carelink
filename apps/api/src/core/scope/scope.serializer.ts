import { getScopeMeta, getScopeOwnerProperty, hasScopeMeta } from './scope.decorator';
import type { ScopeName, Viewer } from './scope.types';

/**
 * @Scope 선언에 따라 객체에서 볼 수 없는 필드를 제거한다.
 *
 * 핵심 규칙 세 가지:
 *   1) deny by default — @Scope가 없는 필드는 아무에게도 나가지 않는다.
 *   2) 마스킹이 아니라 삭제 — 키 자체를 지운다. null로 남기면 존재 여부가 새고,
 *      docs/09 §4.1-4의 "최소 노출" 원칙에도 어긋난다.
 *   3) 'self'는 역할이 아니라 관계 — @ScopeOwner가 가리키는 값이 viewer.userId와
 *      일치할 때만 붙는다. 뷰어의 고정 속성으로 두면 기관 담당자가 남의 프로필을
 *      self로 열어 본다.
 */
export function applyScope<T extends object>(instance: T, viewer: Viewer): Record<string, unknown> {
  return serializeObject(instance, viewer, new Set<ScopeName>(viewer.scopes), true);
}

/**
 * @param inherited 부모에서 이미 확정된 scope 집합. 중첩 DTO는 이것을 물려받는다 —
 *   부모가 self로 열린 레코드의 하위 객체는 같은 레코드의 일부이므로, 자식마다
 *   소유자를 다시 선언하게 하면 선언이 늘어나고 하나만 빠뜨려도 응답이 조용히 빈다.
 */
function serializeObject(
  instance: object,
  viewer: Viewer,
  inherited: Set<ScopeName>,
  isRoot: boolean,
): Record<string, unknown> {
  const ctor = instance.constructor;
  if (!hasScopeMeta(ctor)) {
    // scope 선언이 없는 DTO는 통제 대상이 아니다 (예: 마스터 데이터, 통계).
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(instance)) {
      if (v !== undefined) out[k] = serializeValue(v, viewer, inherited);
    }
    return out;
  }

  const meta = getScopeMeta(ctor);
  const allowed = new Set<ScopeName>(inherited);

  const ownerProp = getScopeOwnerProperty(ctor);
  if (ownerProp && viewer.userId) {
    const ownerId = (instance as Record<string, unknown>)[ownerProp];
    if (typeof ownerId === 'string' && ownerId === viewer.userId) allowed.add('self');
  }

  // self를 쓰면서 소유자를 알 길이 없는 DTO는 본인에게도 빈 객체로 나간다.
  // 최상위에서만 검사한다 — 중첩 DTO는 부모가 소유자를 확정했으므로 자기 선언이 필요 없다.
  if (isRoot && !ownerProp && meta.some((f) => f.scopes.includes('self'))) {
    const message =
      `${ctor.name}: @Scope('self')를 쓰면서 @ScopeOwner()가 없습니다. ` +
      `소유자를 표시하지 않으면 self가 부여되지 않아 응답이 비어 나갑니다.`;
    if (process.env.NODE_ENV === 'production') console.error(message);
    else throw new Error(message);
  }

  const out: Record<string, unknown> = {};
  for (const field of meta) {
    if (!field.scopes.some((s) => allowed.has(s))) continue;
    const value = (instance as Record<string, unknown>)[field.property];
    if (value === undefined) continue;
    out[field.property] = serializeValue(value, viewer, allowed);
  }
  return out;
}

function serializeValue(value: unknown, viewer: Viewer, inherited: Set<ScopeName>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => serializeValue(v, viewer, inherited));
  return serializeObject(value as object, viewer, inherited, false);
}
