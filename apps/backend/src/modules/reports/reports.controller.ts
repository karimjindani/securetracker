import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { CurrentUser } from '../auth/current-user.types.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ReportsService, type CreateReportDto } from './reports.service.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get('engagements/:id/reports')
  listForEngagement(@Param('id') engagementId: string, @CurrentUserParam() user: CurrentUser) {
    return this.reportsService.listForEngagement(engagementId, user);
  }

  @Post('engagements/:id/reports')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN', 'VENDOR_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Param('id') engagementId: string,
    @Body() body: CreateReportDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUserParam() user: CurrentUser
  ) {
    return this.reportsService.createReport(engagementId, body, file, user);
  }

  @Get('reports/:id')
  get(@Param('id') id: string, @CurrentUserParam() user: CurrentUser) {
    return this.reportsService.getReport(id, user);
  }

  @Post('reports/:id/versions')
  @Roles('SYSTEM_ADMIN', 'PAYSYS_SECURITY_ADMIN', 'VENDOR_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  addVersion(
    @Param('id') reportId: string,
    @Body() body: Pick<CreateReportDto, 'uploadNotes'>,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUserParam() user: CurrentUser
  ) {
    return this.reportsService.addVersion(reportId, body, file, user);
  }

  @Get('reports/:id/versions/:versionId/download')
  @Header('Cache-Control', 'no-store')
  async download(
    @Param('id') reportId: string,
    @Param('versionId') versionId: string,
    @CurrentUserParam() user: CurrentUser,
    @Res() response: Response
  ) {
    const stream = await this.reportsService.getVersionStream(reportId, versionId, user, 'download');
    response.setHeader('Content-Type', stream.fileMimeType);
    response.setHeader('Content-Length', stream.fileSizeBytes);
    response.setHeader('Content-Disposition', `attachment; filename="${stream.fileName.replaceAll('"', '')}"`);
    stream.body.pipe(response);
  }

  @Get('reports/:id/versions/:versionId/view')
  @Header('Cache-Control', 'no-store')
  async view(
    @Param('id') reportId: string,
    @Param('versionId') versionId: string,
    @CurrentUserParam() user: CurrentUser,
    @Res() response: Response
  ) {
    const stream = await this.reportsService.getVersionStream(reportId, versionId, user, 'view');
    response.setHeader('Content-Type', stream.fileMimeType);
    response.setHeader('Content-Length', stream.fileSizeBytes);
    response.setHeader('Content-Disposition', `inline; filename="${stream.fileName.replaceAll('"', '')}"`);
    stream.body.pipe(response);
  }
}
