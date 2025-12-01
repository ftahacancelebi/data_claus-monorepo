export interface IngestEvent {
  event_id: string;
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
}

export interface IngestResponse {
  status: string;
  event_id: string;
}

export interface DataClausConfig {
  apiKey?: string; // For future auth
  endpoint: string;
}
