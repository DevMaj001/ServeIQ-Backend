const PAYSTACK_API = 'https://api.paystack.co';

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface CreateCustomerResponse {
  customer_code: string;
}

interface InitializeTransactionResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface SubscriptionResponse {
  email_token: string;
  subscription_code: string;
}

interface VerifyTransactionResponse {
  amount: number;
  status: string;
  reference: string;
  paid_at: string;
  created_at: string;
  channel: string;
  currency: string;
  customer: {
    customer_code: string;
    email: string;
  };
  plan?: {
    id: number;
    name: string;
    plan_code: string;
  };
  subscription?: {
    subscription_code: string;
    email_token: string;
    next_payment_date: string;
  };
}

export class PaystackClient {
  constructor(private readonly secretKey: string) {}

  private async request<T>(
    method: 'get' | 'post',
    path: string,
    body?: unknown,
  ): Promise<PaystackResponse<T>> {
    let res: Response;
    try {
      res = await fetch(`${PAYSTACK_API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(
        `Paystack request failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    let json: PaystackResponse<T>;
    try {
      json = (await res.json()) as PaystackResponse<T>;
    } catch {
      throw new Error(
        `Paystack returned a non-JSON response (HTTP ${res.status})`,
      );
    }

    if (!res.ok || !json.status) {
      const message =
        json?.message || `Paystack API error (HTTP ${res.status})`;
      const err = new Error(message) as Error & { response?: unknown };
      err.response = json;
      throw err;
    }

    return json;
  }

  async createCustomer(
    email: string,
  ): Promise<PaystackResponse<CreateCustomerResponse>> {
    return this.request<CreateCustomerResponse>('post', '/customer', { email });
  }

  async initializeTransaction(params: {
    amount: number;
    email: string;
    plan: string;
    callback_url?: string;
    channels: string[];
  }): Promise<PaystackResponse<InitializeTransactionResponse>> {
    const body: Record<string, unknown> = {
      amount: params.amount,
      email: params.email,
      plan: params.plan,
      channels: params.channels,
    };
    if (params.callback_url) {
      body.callback_url = params.callback_url;
    }
    return this.request<InitializeTransactionResponse>(
      'post',
      '/transaction/initialize',
      body,
    );
  }

  async getSubscription(
    codeOrId: string,
  ): Promise<PaystackResponse<SubscriptionResponse>> {
    return this.request<SubscriptionResponse>(
      'get',
      `/subscription/${encodeURIComponent(codeOrId)}`,
    );
  }

  async verifyTransaction(
    reference: string,
  ): Promise<PaystackResponse<VerifyTransactionResponse>> {
    return this.request<VerifyTransactionResponse>(
      'get',
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
  }

  async disableSubscription(
    code: string,
    token: string,
  ): Promise<PaystackResponse<unknown>> {
    return this.request<unknown>('post', '/subscription/disable', {
      code,
      token,
    });
  }
}
