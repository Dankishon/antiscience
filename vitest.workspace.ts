import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/shared/vitest.config.ts',
  'apps/backend/vitest.config.ts',
  'apps/frontend/vitest.config.ts',
]);
