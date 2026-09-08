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
    channels: string[];
  }): Promise<PaystackResponse<InitializeTransactionResponse>> {
    return this.request<InitializeTransactionResponse>(
      'post',
      '/transaction/initialize',
      params,
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
