import { Controller, Get, Inject, Param } from '@nestjs/common';
import { SurveysService } from './surveys.service';

@Controller('v1/surveys')
export class SurveysController {
  constructor(@Inject(SurveysService) private readonly surveysService: SurveysService) {}

  @Get(':slug/active')
  getActiveSurvey(@Param('slug') slug: string) {
    return this.surveysService.getActiveSurvey(slug);
  }

  @Get(':id/questions')
  getSurveyQuestions(@Param('id') id: string) {
    return this.surveysService.getSurveyQuestions(id);
  }
}
