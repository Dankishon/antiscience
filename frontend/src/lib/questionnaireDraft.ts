import type { ActiveSurvey, ResponseSession } from './api';

const QUESTIONNAIRE_DRAFT_PREFIX = 'flower-profile-questionnaire-draft';

export interface QuestionnaireDraft {
  surveyCode: string;
  surveyVersion: number;
  responseSession: ResponseSession;
  answers: Record<string, number>;
  currentIndex: number;
  updatedAt: string;
}

function storageKey(userId: string): string {
  return `${QUESTIONNAIRE_DRAFT_PREFIX}:${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function loadQuestionnaireDraft(userId: string): QuestionnaireDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey(userId));
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsedValue) || !isRecord(parsedValue.responseSession) || !isRecord(parsedValue.answers)) {
      return null;
    }

    const draft = parsedValue as Partial<QuestionnaireDraft>;
    const rawAnswers = parsedValue.answers;
    if (
      typeof draft.surveyCode !== 'string' ||
      typeof draft.surveyVersion !== 'number' ||
      typeof draft.currentIndex !== 'number' ||
      typeof draft.updatedAt !== 'string'
    ) {
      return null;
    }

    return {
      surveyCode: draft.surveyCode,
      surveyVersion: draft.surveyVersion,
      responseSession: draft.responseSession as ResponseSession,
      answers: Object.fromEntries(
        Object.entries(rawAnswers).filter(
          (entry): entry is [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number',
        ),
      ),
      currentIndex: draft.currentIndex,
      updatedAt: draft.updatedAt,
    };
  } catch {
    return null;
  }
}

export function saveQuestionnaireDraft(
  userId: string,
  survey: Pick<ActiveSurvey, 'code' | 'version'>,
  responseSession: ResponseSession,
  answers: Record<string, number>,
  currentIndex: number,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: QuestionnaireDraft = {
    surveyCode: survey.code,
    surveyVersion: survey.version,
    responseSession,
    answers,
    currentIndex,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
}

export function clearQuestionnaireDraft(userId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(storageKey(userId));
}
