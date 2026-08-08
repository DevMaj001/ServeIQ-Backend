import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface AuthenticatedRequest extends Request {
  user?: {
    branchId: string;
  };
  branchId?: string;
}

export const BranchId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.branchId || request.user?.branchId;
  },
);