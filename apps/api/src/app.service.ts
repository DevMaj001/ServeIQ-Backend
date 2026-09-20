import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // Schema is owned exclusively by versioned migrations (see
  // src/database/migrations/index.ts). The ad-hoc DDL that used to run here
  // on bootstrap — inside a swallowed try/catch that could leave bills
  // columns missing — now lives in migration
  // 1880000000001-VersionBootSchemaSync.

  getHello(): string {
    return 'Hello World!';
  }
}
