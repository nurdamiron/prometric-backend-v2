// Health Controller - Interface Layer
import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetSystemHealthQuery } from '../application/queries/get-system-health/get-system-health.query';

@Controller('health')
export class HealthController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  async getHealth(@Query('details') includeDetails?: string) {
    const shouldIncludeDetails = includeDetails === 'true';

    const query = new GetSystemHealthQuery(shouldIncludeDetails);
    return await this.queryBus.execute(query);
  }

  @Get('simple')
  async getSimpleHealth() {
    const query = new GetSystemHealthQuery(false);
    return await this.queryBus.execute(query);
  }

  @Get('detailed')
  async getDetailedHealth() {
    const query = new GetSystemHealthQuery(true);
    return await this.queryBus.execute(query);
  }
}