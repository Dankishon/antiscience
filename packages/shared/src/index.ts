export const APP_NAME = 'flower-survey';

export type ServiceStatus = 'ok' | 'degraded';

export interface ApiHealthResponse {
  service: string;
  status: ServiceStatus;
  timestamp: string;
  database: {
    configured: boolean;
    provider: 'postgresql';
  };
  auth: {
    jwtConfigured: boolean;
    oauthConfigured: boolean;
  };
}

export interface SurveyHeroContent {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
}

export const SURVEY_HERO_CONTENT: SurveyHeroContent = {
  eyebrow: 'Monorepo ready',
  title: 'Flower Survey workspace',
  description:
    'Frontend on Next.js, backend on NestJS and a shared TypeScript package are wired together.',
  ctaLabel: 'Start building the first questionnaire',
};
