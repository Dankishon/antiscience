export interface User {
  id: string;
  username: string;
  is_guest: boolean;
  created_at: string;
}

export interface SurveyQuestion {
  code: string;
  number: number;
  prompt: string;
  scale_code: string;
  flower_code: string;
  flower_title: string;
  flower_symbol: string | null;
  min_value: number;
  max_value: number;
}

export interface ActiveSurvey {
  code: string;
  version: number;
  title: string;
  description: string;
  instruction: string;
  algorithm_version: string;
  question_count: number;
  likert_scale: Array<{
    value: number;
    label: string;
  }>;
  questions: SurveyQuestion[];
}

export interface ResponseSession {
  id: string;
  survey_code: string;
  survey_version: number;
  status: string;
  answered_count: number;
  total_questions: number;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

export interface ResultPayload {
  response_session_id: string;
  survey_code: string;
  survey_version: number;
  algorithm_version: string;
  mean: number;
  standard_deviation: number;
  main_flower: {
    scale_code: string;
    flower_code: string;
    flower_title: string;
    flower_symbol: string | null;
    raw_score: number;
    z_score: number;
  };
  tie_break: {
    applied: boolean;
    strategy: string;
    candidate_flower_codes: string[];
  };
  scale_scores: Array<{
    scale_code: string;
    flower_code: string;
    flower_title: string;
    flower_symbol: string | null;
    raw_score: number;
    z_score: number;
    rank: number;
    z_level_code: string | null;
    z_level_title: string | null;
  }>;
  interpretation: {
    z_level_code: string | null;
    z_level_title: string | null;
    profile_title: string | null;
    profile_summary: string | null;
    profile_source_header: string | null;
    z_summary: string | null;
    traits: Array<{
      code: string;
      label: string;
      description: string;
      polarity: string;
      sortOrder: number;
    }>;
  };
  submitted_at: string | null;
}

type AuthResponse = {
  user: User;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ detail: 'Request failed' }))) as { detail?: string };
    throw new Error(payload.detail ?? 'Request failed');
  }

  return (await response.json()) as T;
}

export const api = {
  getCurrentUser: () => request<AuthResponse>('/api/auth/me'),
  register: (payload: { username: string; password: string }) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { username: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  guestLogin: () =>
    request<AuthResponse>('/api/auth/guest', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getActiveSurvey: () => request<ActiveSurvey>('/api/survey/active'),
  createResponse: () =>
    request<ResponseSession>('/api/responses', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  saveAnswer: (sessionId: string, answer: { question_code: string; value: number }) =>
    request<ResponseSession>(`/api/responses/${sessionId}/answers`, {
      method: 'PUT',
      body: JSON.stringify({ answers: [answer] }),
    }),
  submitResponse: (sessionId: string) =>
    request<ResultPayload>(`/api/responses/${sessionId}/submit`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getResult: (sessionId: string) => request<ResultPayload>(`/api/responses/${sessionId}/result`),
};
