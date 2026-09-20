import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
@SkipThrottle()
export class HealthController {
  constructor(@Inject(DataSource) private dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness health check' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage().rss,
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness check (verifies the database connection)',
  })
  async ready() {
    let dbConnected = false;
    let dbLatencyMs: number | null = null;
    try {
      const startedAt = Date.now();
      await this.dataSource.query('SELECT 1');
      dbLatencyMs = Date.now() - startedAt;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    const body = {
      status: dbConnected ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbConnected ? 'up' : 'down',
          latency_ms: dbLatencyMs,
        },
      },
    };
    if (!dbConnected) {
      // A readiness probe must FAIL when the instance cannot serve —
      // returning 200 with "not_ready" made load balancers route traffic
      // to instances with no database.
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
