import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccessAuthGuard } from '../auth/access-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminService } from './admin.service';
import { AttachFlowerAssetDto } from './dto/attach-flower-asset.dto';
import { AdminAnalyticsExportQueryDto, AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';
import { UpdateAnonymousRetentionDto } from './dto/update-anonymous-retention.dto';

const ADMIN_DTO_TYPES = [
  AttachFlowerAssetDto,
  AdminAnalyticsQueryDto,
  AdminAnalyticsExportQueryDto,
  UpdateAnonymousRetentionDto,
];
void ADMIN_DTO_TYPES;

@Controller('admin')
@UseGuards(AccessAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    @Inject(AdminAnalyticsService)
    private readonly adminAnalytics: AdminAnalyticsService,
    @Inject(AdminService)
    private readonly adminService: AdminService,
  ) {}

  @Post('surveys/:id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('survey.publish')
  publishSurveyVersion(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.adminService.publishSurveyVersion(id, request.authUser!.id, request.requestId ?? null);
  }

  @Post('surveys/:surveyId/flowers/:flowerCode/assets')
  @RequirePermissions('asset.manage')
  attachFlowerAsset(
    @Param('surveyId') surveyId: string,
    @Param('flowerCode') flowerCode: string,
    @Body() input: AttachFlowerAssetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.attachFlowerAsset(
      surveyId,
      flowerCode,
      input,
      request.authUser!.id,
      request.requestId ?? null,
    );
  }

  @Get('analytics/summary')
  @RequirePermissions('analytics.read')
  getAnalyticsSummary(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalytics.getSummary(query.surveyId);
  }

  @Get('analytics/export')
  @RequirePermissions('analytics.export')
  async exportAnalytics(
    @Query() query: AdminAnalyticsExportQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const exported = await this.adminAnalytics.exportAnalytics(
      request.authUser!.id,
      request.requestId ?? null,
      query,
    );

    response.setHeader('Content-Type', exported.contentType);
    for (const [headerName, headerValue] of Object.entries(exported.headers)) {
      response.setHeader(headerName, headerValue);
    }

    if (exported.type === 'csv') {
      response.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
      exported.stream.pipe(response);
      return;
    }

    response.status(HttpStatus.OK).json(exported.body);
  }

  @Get('retention/anonymous-sessions')
  @RequirePermissions('retention.manage')
  getAnonymousSessionRetentionPolicy() {
    return this.adminService.getAnonymousSessionRetentionPolicy();
  }

  @Put('retention/anonymous-sessions')
  @RequirePermissions('retention.manage')
  updateAnonymousSessionRetentionPolicy(
    @Body() input: UpdateAnonymousRetentionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.updateAnonymousSessionRetentionPolicy(
      input,
      request.authUser!.id,
      request.requestId ?? null,
    );
  }
}
