import { Controller, Get, Param, Logger, Req, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { TrackingService } from './tracking.service';

@ApiTags('Tracking')
@Controller('tracking')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(private readonly trackingService: TrackingService) {}

  @Get(':code')
  @SkipTransform()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Get order tracking info by tracking code (no auth required)' })
  @ApiResponse({ status: 200, description: 'Order tracking info.' })
  @ApiResponse({ status: 404, description: 'Tracking code not found.' })
  async getTracking(@Param('code') code: string, @Req() req: Request) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    try {
      return await this.trackingService.getTrackingByCode(code);
    } catch (err) {
      if (err instanceof NotFoundException) {
        this.logger.warn(`Invalid tracking lookup: code=${code}, ip=${ip}`);
      }
      throw err;
    }
  }
}
