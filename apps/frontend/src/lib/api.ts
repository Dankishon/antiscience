export interface ApiErrorPayload {
  error?: {
    code?: string;
    details?: unknown;
    message?: string;
    request_id?: string;
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ActiveSurveyResponse {
  id: string;
  slug: string;
  version: number;
  title: string;
  description: string;
  instruction: string | null;
  algorithmVersion: string;
  tieBreakStrategy: string | null;
  questionCount: number;
  scaleCount: number;
  status: 'active';
}

export interface SurveyQuestionResponse {
  code: string;
  number: number;
  prompt: string;
  sortOrder: number;
  minValue: number;
  maxValue: number;
  required: boolean;
  scale: {
    code: string;
    title: string;
    shortCode: string;
    flowerCode: string;
    flowerTitle: string | null;
    flowerSymbol: string | null;
  } | null;
}

export interface SurveyQuestionsResponse {
  survey: {
    id: string;
    slug: string;
    version: number;
    title: string;
    description: string;
    instruction: string | null;
    algorithmVersion: string;
    questionCount: number;
  };
  likertScale: Array<{
    value: number;
    label: string;
  }>;
  questions: SurveyQuestionResponse[];
}

export interface ResponseSessionResponse {
  id: string;
  surveyId: string;
  surveySlug: string;
  surveyVersion: number;
  userId: string | null;
  status: 'in_progress' | 'submitted';
  answeredCount: number;
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface SubmitResponsePayload extends ResponseSessionResponse {
  mainFlower: {
    scaleCode: string;
    scaleTitle: string;
    flowerCode: string;
    flowerTitle: string;
    flowerSymbol: string;
    rawScore: number;
    zScore: number;
  };
  tieBreak: {
    applied: boolean;
    strategy: string;
    reason: string | null;
    candidateScaleCodes: string[];
    candidateFlowerCodes: string[];
    selectedScaleCode: string;
    selectedFlowerCode: string;
    randomIndex: number | null;
  };
}

export interface ResultResponse {
  responseId: string;
  surveyId: string;
  status: 'submitted';
  submittedAt: string | null;
  result: {
    surveyCode: string;
    surveyVersion: number;
    algorithmVersion: string;
    questionCount: number;
    mean: number;
    standardDeviation: number;
    mainFlower: {
      scaleCode: string;
      scaleTitle: string;
      flowerCode: string;
      flowerTitle: string;
      flowerSymbol: string;
      rawScore: number;
      zScore: number;
    };
    tieBreak: {
      applied: boolean;
      strategy: string;
      reason: string | null;
      candidateScaleCodes: string[];
      candidateFlowerCodes: string[];
      selectedScaleCode: string;
      selectedFlowerCode: string;
      randomIndex: number | null;
    };
    scaleResults: Array<{
      scaleCode: string;
      scaleTitle: string;
      flowerCode: string;
      flowerTitle: string;
      flowerSymbol: string;
      questionCodes: string[];
      questionNumbers: number[];
      answerValues: number[];
      rawScore: number;
      zScore: number;
      rank: number;
      isMainFlower: boolean;
    }>;
  };
}

export interface AuthUserResponse {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    roles: string[];
    createdAt: string;
    lastLoginAt: string | null;
  };
}

export interface MeExportResponse {
  exportVersion: number;
  exportedAt: string;
  user: AuthUserResponse['user'];
  auth: {
    refreshTokens: Array<{
      id: string;
      familyId: string;
      userAgent: string | null;
      ipAddress: string | null;
      expiresAt: string;
      revokedAt: string | null;
      rotatedAt: string | null;
      lastUsedAt: string | null;
      replacedByTokenId: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  responseSessions: Array<{
    id: string;
    surveyId: string;
    surveySlug: string;
    surveyVersion: number;
    status: 'in_progress' | 'submitted';
    createdAt: string;
    updatedAt: string;
    submittedAt: string | null;
    answers: Array<{
      questionCode: string;
      value: number;
    }>;
    result: ResultResponse['result'] | null;
  }>;
  auditLog: Array<{
    id: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown> | null;
    requestId: string | null;
    createdAt: string;
  }>;
}

export interface DeleteMeResponse {
  success: true;
  deletedAt: string;
  deletionAuditId: string;
  deletedResponseSessionsCount: number;
  deletedRefreshTokensCount: number;
  anonymizedAuditEntriesCount: number;
}

export interface AnonymousSessionRetentionResponse {
  retentionDays: number;
  lastCleanupAt: string | null;
  lastDeletedCount: number;
}

export interface UpdateAnonymousSessionRetentionResponse {
  retentionDays: number;
  cleanup: {
    executed: boolean;
    cutoffAt: string | null;
    deletedSessionsCount: number;
    lastCleanupAt: string | null;
  };
}

async function ensureApiResponse(response: Response): Promise<Response> {
  if (response.ok) {
    return response;
  }

  let payload: ApiErrorPayload | null = null;

  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }

  throw new ApiClientError(
    payload?.error?.message ?? `Request failed with status ${String(response.status)}.`,
    response.status,
    payload?.error?.code ?? 'request_failed',
    payload?.error?.details,
  );
}

export async function apiFetchResponse(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  return ensureApiResponse(response);
}

export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetchResponse(path, init);
  return (await response.json()) as T;
}

export async function getActiveSurvey(slug: string) {
  return apiFetchJson<ActiveSurveyResponse>(`/api/v1/surveys/${slug}/active`);
}

export async function getSurveyQuestions(id: string) {
  return apiFetchJson<SurveyQuestionsResponse>(`/api/v1/surveys/${id}/questions`);
}

export async function createResponseSession(surveyId: string) {
  return apiFetchJson<ResponseSessionResponse>('/api/v1/responses', {
    method: 'POST',
    body: JSON.stringify({ surveyId }),
  });
}

export async function updateResponseAnswers(
  responseId: string,
  answers: Array<{ questionCode: string; value: number }>,
) {
  return apiFetchJson<ResponseSessionResponse & { savedAnswersCount: number }>(
    `/api/v1/responses/${responseId}/answers`,
    {
      method: 'PUT',
      body: JSON.stringify({ answers }),
    },
  );
}

export async function submitResponseSession(responseId: string) {
  return apiFetchJson<SubmitResponsePayload>(`/api/v1/responses/${responseId}/submit`, {
    method: 'POST',
  });
}

export async function getResponseResult(responseId: string) {
  return apiFetchJson<ResultResponse>(`/api/v1/responses/${responseId}/result`);
}

export async function getCurrentUser() {
  return apiFetchJson<AuthUserResponse>('/api/auth/me');
}

export async function logoutUser() {
  return apiFetchJson<{ success: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function getMyDataExport() {
  return apiFetchResponse('/api/me/export');
}

export async function deleteMyData(input: { confirmation: 'DELETE'; reason?: string }) {
  return apiFetchJson<DeleteMeResponse>('/api/me/delete', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getAnonymousSessionRetentionPolicy() {
  return apiFetchJson<AnonymousSessionRetentionResponse>('/api/admin/retention/anonymous-sessions');
}

export async function updateAnonymousSessionRetentionPolicy(input: {
  retentionDays: number;
  runCleanup?: boolean;
}) {
  return apiFetchJson<UpdateAnonymousSessionRetentionResponse>('/api/admin/retention/anonymous-sessions', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
