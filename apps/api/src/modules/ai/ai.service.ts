import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: any = null;
  private initPromise: Promise<void> | null = null;

  constructor(private configService: ConfigService) {}

  private async getClient(): Promise<any> {
    if (!this.openai) {
      if (!this.initPromise) {
        this.initPromise = this.initialize();
      }
      await this.initPromise;
    }
    return this.openai;
  }

  private async initialize(): Promise<void> {
    const apiKey = this.configService.get<string>('NEMOTRON_API_KEY');
    const baseURL = this.configService.get<string>('NEMOTRON_BASE_URL');

    if (apiKey) {
      try {
        const { default: OpenAI } = await import('openai');
        this.openai = new OpenAI({ apiKey, baseURL });
      } catch (err) {
        this.logger.error('Failed to initialize OpenAI client', err);
      }
    } else {
      this.logger.warn('NEMOTRON_API_KEY not set, AI features disabled');
    }
  }

  async generateLogic(prompt: string): Promise<string> {
    const client = await this.getClient();
    if (!client) {
      throw new Error('AI service unavailable: NEMOTRON_API_KEY not configured');
    }

    this.logger.log('Generating logic with Nemotron');

    const systemPrompt = `You are an expert business logic generator for a hospitality POS system called ServeIQ.
Your task is to generate perfect, production-ready business logic.
Always provide:
1. A clear explanation of the logic
2. Pros and cons of the approach
3. Any considerations for implementation
4. Code examples if relevant
Keep responses structured and professional.`;

    const response = await client.chat.completions.create({
      model: this.configService.get<string>('NEMOTRON_MODEL', 'meta/llama-3.1-70b-instruct'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    return response.choices[0].message.content || '';
  }

  async analyzeApiProsCons(): Promise<string> {
    const client = await this.getClient();
    if (!client) {
      throw new Error('AI service unavailable: NEMOTRON_API_KEY not configured');
    }

    this.logger.log('Analyzing API pros and cons with Nemotron');

    const systemPrompt = `You are an expert API analyst. Analyze the ServeIQ hospitality POS API and provide:
1. Key strengths (pros)
2. Areas for improvement (cons)
3. Security considerations
4. Performance insights
5. Recommendations for both admin and waiter app integrations
Be thorough but concise.`;

    const apiDescription = `ServeIQ API is a hospitality POS system with these main modules:
- Auth: User authentication (JWT)
- Business & Branch management
- Menu management
- Table management
- Tab/order management
- Billing & payment processing
- Dashboard analytics

Endpoints are RESTful, use NestJS, TypeORM, and PostgreSQL.
It serves two apps: Admin (web) and Waiter (mobile/tablet).`;

    const response = await client.chat.completions.create({
      model: this.configService.get<string>('NEMOTRON_MODEL', 'meta/llama-3.1-70b-instruct'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: apiDescription },
      ],
      temperature: 0.5,
      max_tokens: 2048,
    });

    return response.choices[0].message.content || '';
  }
}
