import { getScopeMeta, getScopeOwnerProperty, hasScopeMeta } from './scope.decorator';
import type { ScopeName, Viewer } from './scope.types';

/**
 * @Scope 선언에 따라 객체에서 볼 수 없는 필드를 제거한다.
 *
 * 핵심 규칙 두 가지:
 *   1) deny by default — @Scope가 없는 필드는 아무에게도 나가지 않는다.
 *   2) 마스킹이 아니라 삭제 — 키 자체를 지운다. null로 남기면 존재 여부가 새고,
 *      docs/09 §4.1-4의 "최소 노출" 원칙에도 어긋난다.
 */
export function applyScope<T extends object>(instance: T, viewer: Viewer): Record<string, unknown> {
  const ctor = instance.constructor;
  if (!hasScopeMeta(ctor)) {
    // scope 선언이 없는 DTO는 통제 대상이 아니다 (예: 마스터 데이터, 통계).
    return serializeNested(instance, viewer);
  }

  const allowed = new Set<ScopeName>(viewer.scopes);

  // 'self'는 역할이 아니라 관계다. 이 레코드의 소유자가 요청자 본인일 때만 붙는다.
  // 뷰어에 고정으로 달아 두면 기관 담당자가 남의 프로필을 self로 열어 본다.
  const ownerProp = getScopeOwnerProperty(ctor);
  if (ownerProp && viewer.userId) {
    const ownerId = (instance as Record<string, unknown>)[ownerProp];
    if (typeof ownerId === 'string' && ownerId === viewer.userId) allowed.add('self');
  }

  const meta = getScopeMeta(ctor);
  const out: Record<string, unknown> = {};

  for (const field of meta) {
    if (!field.scopes.some((s) => allowed.has(s))) continue;
    const value = (instance as Record<string, unknown>)[field.property];
    if (value === undefined) continue;
    out[field.property] = serializeValue(value, viewer);
  }
  return out;
}

function serializeValue(value: unknown, viewer: Viewer): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => serializeValue(v, viewer));
  return applyScope(value as object, viewer);
}

function serializeNested(instance: object, viewer: Viewer): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(instance)) {
    if (v === undefined) continue;
    out[k] = serializeValue(v, viewer);
  }
  return out;
}
