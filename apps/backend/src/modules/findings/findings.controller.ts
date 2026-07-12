import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { CurrentUser } from '../auth/current-user.types.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  FindingsService,
  type AssignFindingDto,
  type CreateEvidenceDto,
  type CreateFindingDto,
  type CreateRevalidationDto,
  type UpdateFindingDto,
  type UpdateFindingStatusDto
} from './findings.service.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class FindingsController {
  constructor(@Inject(FindingsService) private readonly findingsService: FindingsService) {}

  @Get('engagements/:id/findings')
  listForEngagement(@Param('id') engagementId: string, @CurrentUserParam() user: CurrentUser) {
    return this.findingsService.listForEngagement(engagementId, user);
  }

  @Post('engagements/:id/findings')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN', 'VENDOR_ADMIN')
  create(@Param('id') engagementId: string, @Body() body: CreateFindingDto, @CurrentUserParam() user: CurrentUser) {
    return this.findingsService.create(engagementId, body, user);
  }

  @Get('findings/assignees')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  assignees() {
    return this.findingsService.listAssignees();
  }

  @Get('findings/:id')
  get(@Param('id') id: string, @CurrentUserParam() user: CurrentUser) {
    return this.findingsService.get(id, user);
  }

  @Patch('findings/:id')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN', 'VENDOR_ADMIN', 'PAYSYS_DEVELOPER')
  update(@Param('id') id: string, @Body() body: UpdateFindingDto, @CurrentUserParam() user: CurrentUser) {
    return this.findingsService.update(id, body, user);
  }

  @Post('findings/:id/assign')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN')
  assign(@Param('id') id: string, @Body() body: AssignFindingDto, @CurrentUserParam() user: CurrentUser) {
    return this.findingsService.assign(id, body, user);
  }

  @Post('findings/:id/status')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN', 'PAYSYS_DEVELOPER')
  updateStatus(@Param('id') id: string, @Body() body: UpdateFindingStatusDto, @CurrentUserParam() user: CurrentUser) {
    return this.findingsService.updateStatus(id, body, user);
  }

  @Post('findings/:id/evidence')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN', 'PAYSYS_DEVELOPER')
  @UseInterceptors(FileInterceptor('file'))
  createEvidence(
    @Param('id') id: string,
    @Body() body: CreateEvidenceDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUserParam() user: CurrentUser
  ) {
    return this.findingsService.createEvidence(id, body, file, user);
  }

  @Post('findings/:id/revalidations')
  @Roles('SYSTEM_ADMIN', 'VENDOR_ADMIN')
  createRevalidation(
    @Param('id') id: string,
    @Body() body: CreateRevalidationDto,
    @CurrentUserParam() user: CurrentUser
  ) {
    return this.findingsService.createRevalidation(id, body, user);
  }
}
