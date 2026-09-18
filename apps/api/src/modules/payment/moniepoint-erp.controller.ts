import {
  Body,
  ConflictException,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';
import { UserRole } from '../../common/shared';
import {
  EnrollMoniepointErpDto,
  UpdateMoniepointErpDto,
  PushMoniepointPaymentDto,
} from './dto/moniepoint-erp.dto';
import { MoniepointErpService } from './moniepoint-erp.service';
import { MoniepointChannelError } from './moniepoint-channel.client';

/**
 * Per-branch Moniepoint ERP credential management (multi-tenant push-payment
 * integration). Each branch enrolls its OWN Moniepoint credential; the client
 * secret is stored encrypted and never returned by any endpoint here.
 * Everything is scoped to req.user.businessId + req.user.branchId.
 */
@ApiTags('Moniepoint ERP')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('moniepoint/erp')
export class MoniepointErpController {
  constructor(private readonly moniepointErpService: MoniepointErpService) {}

  @Get('credential')
  @ApiOperation({
    summary: 'Get the current branch ERP credential status (secret hidden)',
  })
  @ApiResponse({
    status: 200,
    description: 'Credential status or null if not enrolled.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getCredential(@Request() req: any) {
    const view = await this.moniepointErpService.getCredential(
      req.user.businessId,
      req.user.branchId,
    );
    return { enrolled: !!view, credential: view };
  }

  @Post('credential')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.PAYMENT_GATEWAY)
  @ApiOperation({
    summary: 'Enroll (or replace) the branch Moniepoint ERP credential',
  })
  @ApiResponse({ status: 201, description: 'Credential enrolled.' })
  @ApiResponse({ status: 400, description: 'Missing/invalid fields.' })
  async enrollCredential(
    @Request() req: any,
    @Body() dto: EnrollMoniepointErpDto,
  ) {
    const view = await this.moniepointErpService.upsertCredential(
      req.user.businessId,
      req.user.branchId,
      dto,
    );
    return { enrolled: true, credential: view };
  }

  @Patch('credential')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.PAYMENT_GATEWAY)
  @ApiOperation({
    summary: 'Rotate the secret / change environment / activate',
  })
  @ApiResponse({ status: 200, description: 'Credential updated.' })
  @ApiResponse({
    status: 400,
    description: 'Rotating a secret requires all required fields.',
  })
  async updateCredential(
    @Request() req: any,
    @Body() dto: UpdateMoniepointErpDto,
  ) {
    const view = await this.moniepointErpService.updateCredential(
      req.user.businessId,
      req.user.branchId,
      dto,
    );
    return { enrolled: true, credential: view };
  }

  @Post('push')
  // Waiters/cashiers initiate pushes when settling a table at a POS terminal,
  // mirroring the `bills/tab/:tabId/pay` role gate (no payment_gateway
  // permission — the payment flow is role-based).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.WAITER,
    UserRole.CASHIER,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.OWNER,
  )
  @ApiOperation({
    summary:
      'Push a payment request to a branch POS terminal via its Moniepoint ERP credential',
  })
  @ApiResponse({
    status: 201,
    description:
      'Push accepted by Moniepoint (HTTP 202, no body) or returned as an existing pending/paid push (duplicate).',
  })
  @ApiResponse({
    status: 409,
    description:
      'merchantReference already used for this tenant and unresolvable as an existing push.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Missing/invalid fields, terminal serial not on this branch, or already-paid bill.',
  })
  async pushPayment(
    @Request() req: any,
    @Body() dto: PushMoniepointPaymentDto,
  ) {
    try {
      const push = await this.moniepointErpService.pushPayment(
        req.user.businessId,
        req.user.branchId,
        {
          terminalSerial: dto.terminalSerial,
          amount: dto.amount,
          merchantReference: dto.merchantReference,
          transactionType: 'PURCHASE',
          paymentMethod: dto.paymentMethod,
        },
        { billId: dto.billId },
      );
      return { pushed: true, push };
    } catch (err) {
      if (err instanceof MoniepointChannelError && err.status === 400) {
        // Moniepoint rejects a duplicate merchantReference with 400
        // {"message":"Transaction exists"} — surface it as an idempotency
        // conflict so clients can tell duplicates apart from bad requests.
        throw new ConflictException(
          'Merchant reference already used for this tenant — duplicate push rejected',
        );
      }
      throw err;
    }
  }

  @Get('pushes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.WAITER,
    UserRole.CASHIER,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.OWNER,
  )
  @ApiOperation({
    summary:
      'List the current branch push history (latest first). A linked bill reports a live `settled` flag from the bill itself.',
  })
  @ApiResponse({ status: 200, description: 'Branch push history.' })
  async listPushes(
    @Request() req: any,
    @Query('billId') billId?: string,
    @Query('status') status?: string,
  ) {
    const pushes = await this.moniepointErpService.listPushes(
      req.user.businessId,
      req.user.branchId,
      { billId, status },
    );
    return { pushes };
  }
}
