import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import type { CurrentUser } from '../auth/current-user.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UsersService, type UpsertUserDto } from './users.service.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  @Roles('SYSTEM_ADMIN')
  list() {
    return this.usersService.list();
  }

  @Post()
  @Roles('SYSTEM_ADMIN')
  create(@Body() body: UpsertUserDto, @CurrentUserParam() user: CurrentUser) {
    return this.usersService.create(body, user);
  }

  @Patch(':id')
  @Roles('SYSTEM_ADMIN')
  update(@Param('id') id: string, @Body() body: Partial<UpsertUserDto>, @CurrentUserParam() user: CurrentUser) {
    return this.usersService.update(id, body, user);
  }
}
