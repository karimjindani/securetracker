import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CalendarController],
  providers: [CalendarService]
})
export class CalendarModule {}
