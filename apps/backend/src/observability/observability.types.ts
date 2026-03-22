export interface RequestMetricRecord {
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  requestId: string;
}
