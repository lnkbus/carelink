import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Viewer } from '../../../core/scope/scope.types';
import type { AuthedRequest } from './jwt-auth.guard';

/** 컨트롤러에서 현재 요청자를 받는다. */
export const CurrentViewer = createParamDecorator((_: unknown, ctx: ExecutionContext): Viewer => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().viewer;
});
