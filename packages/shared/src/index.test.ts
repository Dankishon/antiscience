import { describe, expect, it } from 'vitest';
import { APP_NAME, SURVEY_HERO_CONTENT } from './index';

describe('shared package', () => {
  it('exports the project metadata', () => {
    expect(APP_NAME).toBe('flower-survey');
    expect(SURVEY_HERO_CONTENT.title).toContain('Flower Survey');
  });
});
