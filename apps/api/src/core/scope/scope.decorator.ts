import 'reflect-metadata';
import type { ScopeName } from './scope.types';

const SCOPE_META = Symbol('carelink:scope');

interface ScopeFieldMeta {
  property: string;
  scopes: ScopeName[];
}

/**
 * 이 필드를 볼 수 있는 scope를 선언한다. docs/02 §5.2.
 *
 *   class CandidateDto {
 *     @Scope('self', 'admin', 'org') legalName: string;
 *     @Scope('admin')                nationality: string;   // 기관에도 노출 금지 (docs/07 §2.2)
 *   }
 *
 * 선언이 없는 필드는 노출되지 않는다 — deny by default.
 * "권한 밖 필드는 회색 처리가 아니라 아예 렌더링하지 않음" (docs/09 §4.1-4)과 같은 원칙을
 * 서버에서 강제하는 것이다. 응답에 키 자체가 없어야 클라이언트가 우회할 수 없다.
 */
export function Scope(...scopes: ScopeName[]): PropertyDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const existing: ScopeFieldMeta[] = Reflect.getOwnMetadata(SCOPE_META, ctor) ?? [];
    existing.push({ property: String(propertyKey), scopes });
    Reflect.defineMetadata(SCOPE_META, existing, ctor);
  };
}

export function getScopeMeta(ctor: Function): ScopeFieldMeta[] {
  const own: ScopeFieldMeta[] = Reflect.getOwnMetadata(SCOPE_META, ctor) ?? [];
  const parent = Object.getPrototypeOf(ctor);
  if (parent && parent !== Function.prototype && typeof parent === 'function') {
    return [...getScopeMeta(parent), ...own];
  }
  return own;
}

/** 이 DTO 클래스가 scope 통제 대상인지. */
export function hasScopeMeta(ctor: Function): boolean {
  return getScopeMeta(ctor).length > 0;
}
