import type { ResultPayload } from './api';

const HISTORY_STORAGE_KEY = 'flower-profile-result-history';
const HISTORY_LIMIT = 24;

export interface StoredResult extends ResultPayload {
  saved_at: string;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadResultHistory(): StoredResult[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as StoredResult[];
  } catch {
    return [];
  }
}

export function saveResultHistoryEntry(result: ResultPayload): StoredResult[] {
  if (!canUseStorage()) {
    return [];
  }

  const nextEntry: StoredResult = {
    ...result,
    saved_at: new Date().toISOString(),
  };

  const deduplicated = loadResultHistory().filter(
    (entry) => entry.response_session_id !== result.response_session_id,
  );
  const nextHistory = [nextEntry, ...deduplicated].slice(0, HISTORY_LIMIT);
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

export function clearResultHistory(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(HISTORY_STORAGE_KEY);
}
