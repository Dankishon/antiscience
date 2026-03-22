import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ApiErrorException } from '../common/api-error.exception';
import { SurveyCatalogService } from '../results/survey-catalog.service';

@Injectable()
export class SurveysService {
  constructor(@Inject(SurveyCatalogService) private readonly surveyCatalog: SurveyCatalogService) {}

  async getActiveSurvey(slug: string) {
    try {
      const definition = await this.surveyCatalog.getActiveSurveyDefinition(slug);

      return {
        id: definition.survey.id ?? this.surveyCatalog.buildSurveyId(definition.survey.code, definition.survey.version),
        slug: definition.survey.code,
        version: definition.survey.version,
        title: definition.survey.title,
        description: definition.survey.description,
        instruction: definition.survey.instruction ?? null,
        algorithmVersion: definition.survey.algorithmVersion,
        tieBreakStrategy: definition.survey.tieBreakStrategy ?? null,
        questionCount: definition.questions.length,
        scaleCount: definition.scales.length,
        status: 'active' as const,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ApiErrorException(
          HttpStatus.NOT_FOUND,
          'survey_not_found',
          `Survey ${slug} does not have an active version.`,
        );
      }

      throw error;
    }
  }

  async getSurveyQuestions(id: string) {
    try {
      const definition = await this.surveyCatalog.getSurveyDefinitionById(id);
      const scalesByCode = new Map(definition.scales.map((scale) => [scale.code, scale]));
      const flowersByCode = new Map(definition.flowers.map((flower) => [flower.code, flower]));

      return {
        survey: {
          id: definition.survey.id ?? this.surveyCatalog.buildSurveyId(definition.survey.code, definition.survey.version),
          slug: definition.survey.code,
          version: definition.survey.version,
          title: definition.survey.title,
          description: definition.survey.description,
          instruction: definition.survey.instruction ?? null,
          algorithmVersion: definition.survey.algorithmVersion,
          questionCount: definition.questions.length,
        },
        likertScale: definition.survey.likertScale ?? [],
        questions: definition.questions.map((question) => {
          const scale = scalesByCode.get(question.scaleCode);
          const flower = scale ? flowersByCode.get(scale.flowerCode) : null;

          return {
            code: question.code,
            number: question.number,
            prompt: question.prompt,
            sortOrder: question.sortOrder ?? question.number,
            minValue: question.minValue ?? 0,
            maxValue: question.maxValue ?? 4,
            required: question.required ?? true,
            scale: scale
              ? {
                  code: scale.code,
                  title: scale.title,
                  shortCode: scale.shortCode ?? scale.code,
                  flowerCode: scale.flowerCode,
                  flowerTitle: flower?.title ?? null,
                  flowerSymbol: flower?.symbol ?? null,
                }
              : null,
          };
        }),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ApiErrorException(
          HttpStatus.NOT_FOUND,
          'survey_not_found',
          `Survey ${id} does not exist.`,
        );
      }

      throw error;
    }
  }
}
