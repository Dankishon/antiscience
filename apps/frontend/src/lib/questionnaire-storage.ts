const QUESTIONNAIRE_DRAFT_KEY = 'flower-survey:questionnaire-draft';

export interface QuestionnaireDraft {
  responseId: string;
  surveyId: string;
  surveySlug: string;
  totalQuestions: number;
  currentIndex: number;
  answers: Record<string, number>;
  updatedAt: string;
}

export function loadQuestionnaireDraft(): QuestionnaireDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawDraft = window.localStorage.getItem(QUESTIONNAIRE_DRAFT_KEY);
  if (!rawDraft) {
    return null;
  }

  try {
    return JSON.parse(rawDraft) as QuestionnaireDraft;
  } catch {
    window.localStorage.removeItem(QUESTIONNAIRE_DRAFT_KEY);
    return null;
  }
}

export function saveQuestionnaireDraft(draft: QuestionnaireDraft) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(QUESTIONNAIRE_DRAFT_KEY, JSON.stringify(draft));
}

export function clearQuestionnaireDraft() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(QUESTIONNAIRE_DRAFT_KEY);
}
