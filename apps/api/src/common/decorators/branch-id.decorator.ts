import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const BranchId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ branchId?: string; user?: { branchId?: string } }>();
    return request.branchId || request.user?.branchId;
  },
);
