import { Body, Controller, Get, Headers, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { CreateResponseDto } from './dto/create-response.dto';
import { UpdateAnswersDto } from './dto/update-answers.dto';
import { ResponsesService } from './responses.service';

const RESPONSE_DTO_TYPES = [CreateResponseDto, UpdateAnswersDto];
void RESPONSE_DTO_TYPES;

@Controller('v1/responses')
export class ResponsesController {
  constructor(@Inject(ResponsesService) private readonly responsesService: ResponsesService) {}

  @Post()
  createResponse(
    @Body() input: CreateResponseDto,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.responsesService.createResponse(input, userId ?? null);
  }

  @Put(':id/answers')
  updateAnswers(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateAnswersDto,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.responsesService.updateAnswers(id, input, userId ?? null);
  }

  @Post(':id/submit')
  submitResponse(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.responsesService.submitResponse(id, userId ?? null);
  }

  @Get(':id/result')
  getResult(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.responsesService.getResult(id, userId ?? null);
  }
}
