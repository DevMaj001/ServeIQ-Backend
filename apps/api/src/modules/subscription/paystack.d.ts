declare module 'paystack' {
  interface PaystackApiResponse<T> {
    status: boolean;
    message?: string;
    data?: T;
  }

  class Paystack {
    constructor(secretKey: string);
    customer: {
      create(params: {
        email: string;
      }): Promise<PaystackApiResponse<{ customer_code: string }>>;
    };
    transaction: {
      initialize(params: {
        amount: number;
        email: string;
        plan: string;
        channels: string[];
      }): Promise<
        PaystackApiResponse<{
          authorization_url: string;
          access_code: string;
          reference: string;
        }>
      >;
    };
    subscription: {
      get(code: string): Promise<PaystackApiResponse<{ email_token: string }>>;
      disable(params: {
        code: string;
        token: string;
      }): Promise<PaystackApiResponse<Record<string, unknown>>>;
    };
  }

  export = Paystack;
}
