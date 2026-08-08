import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubscriptionService } from '../subscription.service';

@ApiTags('Webhooks')
@Controller({ path: 'webhooks/paystack', version: '1' })
export class PaystackWebhookController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Handle Paystack webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const signature = req.headers['x-paystack-signature'] as string;
    const rawBody =
      (req as any).rawBody?.toString('utf8') ?? JSON.stringify(req.body);

    const isValid = await this.subscriptionService.verifyPaystackSignature(
      signature,
      rawBody,
    );
    if (!isValid) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ status: false, message: 'Invalid signature' });
    }

    const event = req.body;

    switch (event.event) {
      case 'charge.success':
        await this.subscriptionService.handleChargeSuccess(event.data);
        break;

      case 'subscription.create':
        await this.subscriptionService.handleSubscriptionCreate(event.data);
        break;

      case 'invoice.payment_failed':
        await this.subscriptionService.handleInvoicePaymentFailed(event.data);
        break;

      case 'subscription.disable':
        await this.subscriptionService.handleSubscriptionDisable(event.data);
        break;

      default:
        break;
    }

    return res.status(HttpStatus.OK).json({ status: true });
  }
}
