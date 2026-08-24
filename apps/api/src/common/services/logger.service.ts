import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private formatMessage(
    level: string,
    message: unknown,
    ...optionalParams: unknown[]
  ) {
    let msg: unknown = message;
    const errorMeta: Record<string, unknown> = {};
    if (message instanceof Error) {
      msg = message.message || message.name;
      if (message.stack) errorMeta.stack = message.stack;
    } else if (typeof message !== 'string') {
      try {
        msg = JSON.stringify(message);
      } catch {
        msg = String(message);
      }
    }
    const entry = {
      level,
      message: msg,
      timestamp: new Date().toISOString(),
      context: this.context,
      ...errorMeta,
      ...(optionalParams.length > 0 && { params: optionalParams }),
    };
    if (process.env.NODE_ENV === 'production') {
      const writer: ((msg: string) => void)[] = [
        console.log,
        console.error,
        console.warn,
        console.info,
        console.debug,
      ];
      const writerIndex =
        level === 'error'
          ? 1
          : level === 'warn'
            ? 2
            : level === 'info'
              ? 3
              : level === 'debug'
                ? 4
                : 0;
      writer[writerIndex].bind(console)(JSON.stringify(entry));
    } else {
      const prefix = this.context ? `[${this.context}]` : '';
      console.log(`${level.toUpperCase()} ${prefix} ${entry.message}`);
    }
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.formatMessage('log', message, ...optionalParams);
  }
  error(message: unknown, ...optionalParams: unknown[]) {
    this.formatMessage('error', message, ...optionalParams);
  }
  warn(message: unknown, ...optionalParams: unknown[]) {
    this.formatMessage('warn', message, ...optionalParams);
  }
  debug?(message: unknown, ...optionalParams: unknown[]) {
    this.formatMessage('debug', message, ...optionalParams);
  }
  verbose?(message: unknown, ...optionalParams: unknown[]) {
    this.formatMessage('verbose', message, ...optionalParams);
  }
  fatal?(message: unknown, ...optionalParams: unknown[]) {
    this.formatMessage('fatal', message, ...optionalParams);
  }
}
