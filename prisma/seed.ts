import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client/client.ts';
import { TieBreakStrategy } from './generated/client/enums.ts';

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/flower_survey';
const SURVEY_CODE = 'flower-soul-profile';
const SURVEY_VERSION = 1;

interface QuestionsSeed {
  survey: {
    code: string;
    version: number;
    title: string;
    description: string;
    algorithmVersion: string;
    tieBreakStrategy: keyof typeof TieBreakStrategy;
    sourceDocument: string;
    sourceNote: string;
    instruction: string;
    likertScale: Array<{ value: number; label: string }>;
    scoring: Record<string, string>;
  };
  flowers: Array<{
    code: string;
    title: string;
    symbol: string;
    sortOrder: number;
    meaning: string;
    rationale: string;
    scaleCode: string;
    metadata: Record<string, unknown>;
  }>;
  scales: Array<{
    code: string;
    title: string;
    shortCode: string;
    flowerCode: string;
    sortOrder: number;
    minScore: number;
    maxScore: number;
    metadata: Record<string, unknown>;
  }>;
  questions: Array<{
    number: number;
    prompt: string;
    sourceScale: string;
    scaleCode: string;
    code: string;
    sortOrder: number;
    weight: number;
    minValue: number;
    maxValue: number;
    required: boolean;
  }>;
}

interface InterpsSeed {
  survey: {
    code: string;
    version: number;
    sourceDocument: string;
    algorithmVersion: string;
  };
  sourceWarnings: string[];
  zScaleFactor: number;
  zLevels: Array<{
    code: string;
    label: string;
    title: string;
    rangeText: string;
    description: string;
    zFrom: number;
    zTo: number;
    sortOrder: number;
  }>;
  profiles: Array<{
    flowerCode: string;
    flowerTitle: string;
    symbol: string;
    profileInterpretation: {
      code: string;
      title: string;
      summary: string;
      narrative: Record<string, unknown>;
    };
    zInterpretations: Array<{
      code: string;
      zLevelCode: string;
      title: string;
      summary: string;
      sourceRange: string;
      sortOrder: number;
    }>;
    traits: Array<{
      code: string;
      label: string;
      description: string;
      polarity: number;
      sortOrder: number;
    }>;
  }>;
}

async function readJsonFile<T>(fileName: string): Promise<T> {
  const filePath = path.join(process.cwd(), 'seeds', fileName);
  const fileContents = await readFile(filePath, 'utf8');
  return JSON.parse(fileContents) as T;
}

function assertSurveyVersionConsistency(
  questionsSeed: QuestionsSeed,
  interpsSeed: InterpsSeed,
): void {
  const checks = [
    [questionsSeed.survey.code, SURVEY_CODE, 'questions survey.code'],
    [interpsSeed.survey.code, SURVEY_CODE, 'interps survey.code'],
    [questionsSeed.survey.version, SURVEY_VERSION, 'questions survey.version'],
    [interpsSeed.survey.version, SURVEY_VERSION, 'interps survey.version'],
  ] as const;

  for (const [actual, expected, label] of checks) {
    if (actual !== expected) {
      throw new Error(`Seed mismatch for ${label}: expected ${expected}, received ${actual}`);
    }
  }
}

async function main() {
  const questionsSeed = await readJsonFile<QuestionsSeed>('questions.v1.json');
  const interpsSeed = await readJsonFile<InterpsSeed>('interps.v1.json');

  assertSurveyVersionConsistency(questionsSeed, interpsSeed);

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (tx) => {
      const survey = await tx.survey.upsert({
        where: {
          code_version: {
            code: questionsSeed.survey.code,
            version: questionsSeed.survey.version,
          },
        },
        update: {
          title: questionsSeed.survey.title,
          description: questionsSeed.survey.description,
          algorithmVersion: questionsSeed.survey.algorithmVersion,
          tieBreakStrategy: TieBreakStrategy[questionsSeed.survey.tieBreakStrategy],
          isActive: true,
          settings: {
            sourceDocument: questionsSeed.survey.sourceDocument,
            sourceNote: questionsSeed.survey.sourceNote,
            instruction: questionsSeed.survey.instruction,
            likertScale: questionsSeed.survey.likertScale,
            scoring: questionsSeed.survey.scoring,
            zScaleFactor: interpsSeed.zScaleFactor,
            sourceWarnings: interpsSeed.sourceWarnings,
          },
        },
        create: {
          code: questionsSeed.survey.code,
          version: questionsSeed.survey.version,
          title: questionsSeed.survey.title,
          description: questionsSeed.survey.description,
          algorithmVersion: questionsSeed.survey.algorithmVersion,
          tieBreakStrategy: TieBreakStrategy[questionsSeed.survey.tieBreakStrategy],
          isActive: true,
          publishedAt: new Date(),
          settings: {
            sourceDocument: questionsSeed.survey.sourceDocument,
            sourceNote: questionsSeed.survey.sourceNote,
            instruction: questionsSeed.survey.instruction,
            likertScale: questionsSeed.survey.likertScale,
            scoring: questionsSeed.survey.scoring,
            zScaleFactor: interpsSeed.zScaleFactor,
            sourceWarnings: interpsSeed.sourceWarnings,
          },
        },
      });

      const flowerIdByCode = new Map<string, string>();
      for (const flower of questionsSeed.flowers) {
        const record = await tx.flower.upsert({
          where: {
            surveyId_code: {
              surveyId: survey.id,
              code: flower.code,
            },
          },
          update: {
            title: flower.title,
            description: flower.meaning,
            sortOrder: flower.sortOrder,
            priority: flower.sortOrder,
            metadata: {
              symbol: flower.symbol,
              rationale: flower.rationale,
              ...flower.metadata,
            },
          },
          create: {
            surveyId: survey.id,
            code: flower.code,
            title: flower.title,
            description: flower.meaning,
            sortOrder: flower.sortOrder,
            priority: flower.sortOrder,
            metadata: {
              symbol: flower.symbol,
              rationale: flower.rationale,
              ...flower.metadata,
            },
          },
        });
        flowerIdByCode.set(flower.code, record.id);
      }

      const scaleIdByCode = new Map<string, string>();
      const scaleToFlowerCode = new Map<string, string>();
      for (const scale of questionsSeed.scales) {
        const flowerId = flowerIdByCode.get(scale.flowerCode);
        if (!flowerId) {
          throw new Error(`Flower not found for scale ${scale.code}`);
        }

        const record = await tx.scale.upsert({
          where: {
            surveyId_code: {
              surveyId: survey.id,
              code: scale.code,
            },
          },
          update: {
            flowerId,
            title: scale.title,
            description: `${scale.title} — ${questionsSeed.flowers.find((item) => item.code === scale.flowerCode)?.title ?? ''}`,
            sortOrder: scale.sortOrder,
            minScore: scale.minScore,
            maxScore: scale.maxScore,
            metadata: scale.metadata,
          },
          create: {
            surveyId: survey.id,
            flowerId,
            code: scale.code,
            title: scale.title,
            description: `${scale.title} — ${questionsSeed.flowers.find((item) => item.code === scale.flowerCode)?.title ?? ''}`,
            sortOrder: scale.sortOrder,
            minScore: scale.minScore,
            maxScore: scale.maxScore,
            metadata: scale.metadata,
          },
        });

        scaleIdByCode.set(scale.code, record.id);
        scaleToFlowerCode.set(scale.code, scale.flowerCode);
      }

      for (const question of questionsSeed.questions) {
        const scaleId = scaleIdByCode.get(question.scaleCode);
        if (!scaleId) {
          throw new Error(`Scale not found for question ${question.code}`);
        }

        await tx.question.upsert({
          where: {
            surveyId_code: {
              surveyId: survey.id,
              code: question.code,
            },
          },
          update: {
            scaleId,
            prompt: question.prompt,
            helpText: null,
            sortOrder: question.sortOrder,
            weight: question.weight,
            minValue: question.minValue,
            maxValue: question.maxValue,
            isRequired: question.required,
            isReverseScored: false,
            metadata: {
              questionNumber: question.number,
              sourceScale: question.sourceScale,
            },
          },
          create: {
            surveyId: survey.id,
            scaleId,
            code: question.code,
            prompt: question.prompt,
            helpText: null,
            sortOrder: question.sortOrder,
            weight: question.weight,
            minValue: question.minValue,
            maxValue: question.maxValue,
            isRequired: question.required,
            isReverseScored: false,
            metadata: {
              questionNumber: question.number,
              sourceScale: question.sourceScale,
            },
          },
        });
      }

      const zLevelIdByScaleAndCode = new Map<string, string>();
      for (const scale of questionsSeed.scales) {
        const scaleId = scaleIdByCode.get(scale.code);
        if (!scaleId) {
          throw new Error(`Scale not found for z-level seeding: ${scale.code}`);
        }

        for (const zLevel of interpsSeed.zLevels) {
          const record = await tx.zLevel.upsert({
            where: {
              scaleId_code: {
                scaleId,
                code: zLevel.code,
              },
            },
            update: {
              surveyId: survey.id,
              label: zLevel.label,
              description: zLevel.description,
              zFrom: zLevel.zFrom,
              zTo: zLevel.zTo,
              sortOrder: zLevel.sortOrder,
              metadata: {
                title: zLevel.title,
                rangeText: zLevel.rangeText,
                zScaleFactor: interpsSeed.zScaleFactor,
              },
            },
            create: {
              surveyId: survey.id,
              scaleId,
              code: zLevel.code,
              label: zLevel.label,
              description: zLevel.description,
              zFrom: zLevel.zFrom,
              zTo: zLevel.zTo,
              sortOrder: zLevel.sortOrder,
              metadata: {
                title: zLevel.title,
                rangeText: zLevel.rangeText,
                zScaleFactor: interpsSeed.zScaleFactor,
              },
            },
          });

          zLevelIdByScaleAndCode.set(`${scale.code}:${zLevel.code}`, record.id);
        }
      }

      for (const profile of interpsSeed.profiles) {
        const flowerId = flowerIdByCode.get(profile.flowerCode);
        const scaleCode = questionsSeed.scales.find(
          (item) => item.flowerCode === profile.flowerCode,
        )?.code;

        if (!flowerId || !scaleCode) {
          throw new Error(`Profile mapping failed for flower ${profile.flowerCode}`);
        }

        const baseInterpretation = await tx.flowerInterpretation.upsert({
          where: {
            surveyId_code: {
              surveyId: survey.id,
              code: profile.profileInterpretation.code,
            },
          },
          update: {
            flowerId,
            zLevelId: null,
            title: profile.profileInterpretation.title,
            summary: profile.profileInterpretation.summary,
            narrative: {
              ...profile.profileInterpretation.narrative,
              flowerTitle: profile.flowerTitle,
              symbol: profile.symbol,
            },
            sortOrder: 0,
          },
          create: {
            surveyId: survey.id,
            flowerId,
            zLevelId: null,
            code: profile.profileInterpretation.code,
            title: profile.profileInterpretation.title,
            summary: profile.profileInterpretation.summary,
            narrative: {
              ...profile.profileInterpretation.narrative,
              flowerTitle: profile.flowerTitle,
              symbol: profile.symbol,
            },
            sortOrder: 0,
          },
        });

        for (const interpretation of profile.zInterpretations) {
          const zLevelId = zLevelIdByScaleAndCode.get(`${scaleCode}:${interpretation.zLevelCode}`);
          if (!zLevelId) {
            throw new Error(
              `Z-level mapping not found for ${profile.flowerCode}:${interpretation.zLevelCode}`,
            );
          }

          await tx.flowerInterpretation.upsert({
            where: {
              surveyId_code: {
                surveyId: survey.id,
                code: interpretation.code,
              },
            },
            update: {
              flowerId,
              zLevelId,
              title: interpretation.title,
              summary: interpretation.summary,
              narrative: {
                sourceRange: interpretation.sourceRange,
                zLevelCode: interpretation.zLevelCode,
                flowerTitle: profile.flowerTitle,
                symbol: profile.symbol,
              },
              sortOrder: interpretation.sortOrder,
            },
            create: {
              surveyId: survey.id,
              flowerId,
              zLevelId,
              code: interpretation.code,
              title: interpretation.title,
              summary: interpretation.summary,
              narrative: {
                sourceRange: interpretation.sourceRange,
                zLevelCode: interpretation.zLevelCode,
                flowerTitle: profile.flowerTitle,
                symbol: profile.symbol,
              },
              sortOrder: interpretation.sortOrder,
            },
          });
        }

        for (const trait of profile.traits) {
          await tx.trait.upsert({
            where: {
              flowerInterpretationId_code: {
                flowerInterpretationId: baseInterpretation.id,
                code: trait.code,
              },
            },
            update: {
              label: trait.label,
              description: trait.description,
              polarity: trait.polarity,
              sortOrder: trait.sortOrder,
            },
            create: {
              flowerInterpretationId: baseInterpretation.id,
              code: trait.code,
              label: trait.label,
              description: trait.description,
              polarity: trait.polarity,
              sortOrder: trait.sortOrder,
            },
          });
        }
      }
    });

    console.log(
      `Seed completed for survey ${SURVEY_CODE} v${SURVEY_VERSION} using ${path.join(
        'seeds',
        'questions.v1.json',
      )} and ${path.join('seeds', 'interps.v1.json')}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
