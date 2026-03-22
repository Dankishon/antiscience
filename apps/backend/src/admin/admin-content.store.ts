import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FlowerAssetRecord, PublishedSurveyRecord } from './admin.types';

interface PublishSurveyInput {
  surveyId: string;
  surveyCode: string;
  surveyVersion: number;
  publishedByUserId: string;
}

interface CreateAssetInput {
  surveyId: string;
  flowerCode: string;
  kind: string;
  title: string | null;
  altText: string | null;
  storageKey: string;
  publicUrl: string | null;
  mimeType: string;
  visibility: 'private' | 'internal' | 'public';
  metadata: Record<string, unknown> | null;
  createdByUserId: string;
}

@Injectable()
export class AdminContentStoreService {
  private readonly publishedSurveys = new Map<string, PublishedSurveyRecord>();
  private readonly assetsBySurveyAndFlower = new Map<string, FlowerAssetRecord[]>();

  publishSurvey(input: PublishSurveyInput): PublishedSurveyRecord {
    const record: PublishedSurveyRecord = {
      surveyId: input.surveyId,
      surveyCode: input.surveyCode,
      surveyVersion: input.surveyVersion,
      publishedAt: new Date().toISOString(),
      publishedByUserId: input.publishedByUserId,
    };

    this.publishedSurveys.set(record.surveyId, record);
    return record;
  }

  getPublishedSurvey(surveyId: string): PublishedSurveyRecord | null {
    return this.publishedSurveys.get(surveyId) ?? null;
  }

  attachAsset(input: CreateAssetInput): FlowerAssetRecord {
    const asset: FlowerAssetRecord = {
      id: randomUUID(),
      surveyId: input.surveyId,
      flowerCode: input.flowerCode,
      kind: input.kind,
      title: input.title,
      altText: input.altText,
      storageKey: input.storageKey,
      publicUrl: input.publicUrl,
      mimeType: input.mimeType,
      visibility: input.visibility,
      metadata: input.metadata,
      createdByUserId: input.createdByUserId,
      createdAt: new Date().toISOString(),
    };

    const key = buildAssetKey(input.surveyId, input.flowerCode);
    const existing = this.assetsBySurveyAndFlower.get(key) ?? [];
    this.assetsBySurveyAndFlower.set(key, [...existing, asset]);
    return asset;
  }

  listAssets(surveyId: string, flowerCode: string): FlowerAssetRecord[] {
    return this.assetsBySurveyAndFlower.get(buildAssetKey(surveyId, flowerCode)) ?? [];
  }
}

function buildAssetKey(surveyId: string, flowerCode: string): string {
  return `${surveyId}:${flowerCode}`;
}
