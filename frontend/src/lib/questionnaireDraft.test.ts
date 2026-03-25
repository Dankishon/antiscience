import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearQuestionnaireDraft,
  loadQuestionnaireDraft,
  saveQuestionnaireDraft,
} from './questionnaireDraft';

const userId = 'user-1';

describe('questionnaireDraft helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and restores questionnaire draft state', () => {
    saveQuestionnaireDraft(
      userId,
      { code: 'flower-soul-profile', version: 1 },
      {
        id: 'session-1',
        survey_code: 'flower-soul-profile',
        survey_version: 1,
        status: 'in_progress',
        answered_count: 2,
        total_questions: 30,
        created_at: '2026-03-25T08:00:00Z',
        updated_at: '2026-03-25T08:10:00Z',
        submitted_at: null,
      },
      { hs_01: 4, hs_02: 3 },
      2,
    );

    expect(loadQuestionnaireDraft(userId)).toMatchObject({
      surveyCode: 'flower-soul-profile',
      surveyVersion: 1,
      responseSession: {
        id: 'session-1',
        answered_count: 2,
      },
      answers: { hs_01: 4, hs_02: 3 },
      currentIndex: 2,
    });
  });

  it('clears questionnaire draft state', () => {
    saveQuestionnaireDraft(
      userId,
      { code: 'flower-soul-profile', version: 1 },
      {
        id: 'session-1',
        survey_code: 'flower-soul-profile',
        survey_version: 1,
        status: 'in_progress',
        answered_count: 1,
        total_questions: 30,
        created_at: '2026-03-25T08:00:00Z',
        updated_at: '2026-03-25T08:10:00Z',
        submitted_at: null,
      },
      { hs_01: 4 },
      1,
    );

    clearQuestionnaireDraft(userId);

    expect(loadQuestionnaireDraft(userId)).toBeNull();
  });
});
