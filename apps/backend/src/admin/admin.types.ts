export type AssetVisibilityCode = 'private' | 'internal' | 'public';

export interface PublishedSurveyRecord {
  surveyId: string;
  surveyCode: string;
  surveyVersion: number;
  publishedAt: string;
  publishedByUserId: string;
}

export interface FlowerAssetRecord {
  id: string;
  surveyId: string;
  flowerCode: string;
  kind: string;
  title: string | null;
  altText: string | null;
  storageKey: string;
  publicUrl: string | null;
  mimeType: string;
  visibility: AssetVisibilityCode;
  metadata: Record<string, unknown> | null;
  createdByUserId: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: string;
}
