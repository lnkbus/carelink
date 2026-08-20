import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError } from '../../../core/errors/domain-error';
import type { UserRole } from '../iam.types';
import type { AuthedRequest } from './jwt-auth.guard';

export const REQUIRED_ROLES = 'carelink:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const held = req.viewer?.roles ?? [];
    if (!required.some((r) => held.includes(r))) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', { required, held });
    }
    return true;
  }
}
