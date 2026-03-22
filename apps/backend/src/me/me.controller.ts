import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccessAuthGuard } from '../auth/access-auth.guard';
import { clearCookie, parseCookieHeader } from '../auth/auth-cookie.util';
import { AuthConfigService } from '../auth/auth.config';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { DeleteMeDto } from './dto/delete-me.dto';
import { MeService } from './me.service';

const ME_DTO_TYPES = [DeleteMeDto];
void ME_DTO_TYPES;

@Controller('me')
@UseGuards(AccessAuthGuard)
export class MeController {
  constructor(
    @Inject(AuthConfigService) private readonly authConfig: AuthConfigService,
    @Inject(MeService) private readonly meService: MeService,
  ) {}

  @Get('export')
  exportMyData(@Req() request: AuthenticatedRequest, @Res() response: Response) {
    const payload = this.meService.exportMyData(request.authUser!);
    const fileStamp = payload.exportedAt.replace(/[:.]/g, '-');

    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="flower-survey-me-export-${fileStamp}.json"`);
    response.status(HttpStatus.OK).json(payload);
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  deleteMyData(
    @Body() input: DeleteMeDto,
    @Headers('cookie') cookieHeader: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = this.meService.deleteMyData(request.authUser!, request.requestId ?? null, input.reason);
    const cookies = parseCookieHeader(cookieHeader);
    const cookiePath = this.authConfig.cookiePath;
    const cookieSameSite = this.authConfig.cookieSameSite;
    const cookieSecure = this.authConfig.cookieSecure;

    if (cookies[this.authConfig.accessTokenCookieName] || cookies[this.authConfig.refreshTokenCookieName]) {
      response.setHeader('Set-Cookie', [
        clearCookie(this.authConfig.accessTokenCookieName, {
          httpOnly: true,
          secure: cookieSecure,
          sameSite: cookieSameSite,
          path: cookiePath,
        }),
        clearCookie(this.authConfig.refreshTokenCookieName, {
          httpOnly: true,
          secure: cookieSecure,
          sameSite: cookieSameSite,
          path: cookiePath,
        }),
      ]);
    }

    return result;
  }
}
