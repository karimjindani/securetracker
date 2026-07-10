import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  private readonly healthService = new HealthService();

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }
}
