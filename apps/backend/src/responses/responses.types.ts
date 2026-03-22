import type { ComputeResultDto } from '../results/dto/compute-result.dto';

export type ResponseSessionStatus = 'in_progress' | 'submitted';

export interface StoredResponseSession {
  id: string;
  surveyId: string;
  surveyCode: string;
  surveyVersion: number;
  userId: string | null;
  status: ResponseSessionStatus;
  answers: Map<string, number>;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  result: ComputeResultDto | null;
}
