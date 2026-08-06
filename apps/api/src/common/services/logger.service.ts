import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private formatMessage(level: string, message: any, ...optionalParams: any[]) {
    const entry = {
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      timestamp: new Date().toISOString(),
      context: this.context,
      ...(optionalParams.length > 0 && { params: optionalParams }),
    };
    if (process.env.NODE_ENV === 'production') {
      (console as any)[level](JSON.stringify(entry));
    } else {
      const prefix = this.context ? `[${this.context}]` : '';
      console.log(`${level.toUpperCase()} ${prefix} ${entry.message}`);
    }
  }

  log(message: any, ...optionalParams: any[]) {
    this.formatMessage('log', message, ...optionalParams);
  }
  error(message: any, ...optionalParams: any[]) {
    this.formatMessage('error', message, ...optionalParams);
  }
  warn(message: any, ...optionalParams: any[]) {
    this.formatMessage('warn', message, ...optionalParams);
  }
  debug?(message: any, ...optionalParams: any[]) {
    this.formatMessage('debug', message, ...optionalParams);
  }
  verbose?(message: any, ...optionalParams: any[]) {
    this.formatMessage('verbose', message, ...optionalParams);
  }
  fatal?(message: any, ...optionalParams: any[]) {
    this.formatMessage('fatal', message, ...optionalParams);
  }
}
