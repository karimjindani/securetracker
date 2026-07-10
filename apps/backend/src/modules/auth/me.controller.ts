import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUserParam } from './current-user.decorator.js';
import type { CurrentUser } from './current-user.types.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('me')
export class MeController {
  @Get()
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUserParam() user: CurrentUser) {
    return user;
  }
}
