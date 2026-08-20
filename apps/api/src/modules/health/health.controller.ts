import { Controller, Get, Inject } from '@nestjs/common';
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

    const ready = dbConnected;
    return {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbConnected ? 'up' : 'down',
          latency_ms: dbLatencyMs,
        },
      },
    };
  }
}