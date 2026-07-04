import { HttpException, HttpStatus } from '@nestjs/common';

export class SubscriptionRequiredException extends HttpException {
  constructor(reason: string, suggestedAction: string) {
    const messages: Record<string, string> = {
      no_subscription: 'Subscription required',
      expired: 'Your trial has expired. Please subscribe to continue.',
      past_due: 'Payment is past due. Please update your payment method.',
      canceled: 'Your subscription has ended. Please subscribe to continue.',
    };

    super(
      {
        statusCode: 402,
        message: messages[reason] || 'Subscription required',
        reason,
        suggested_action: suggestedAction,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
