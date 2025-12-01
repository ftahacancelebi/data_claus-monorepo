import { DataClausConfig, IngestEvent, IngestResponse } from './types';

export class DataClausClient {
  private config: DataClausConfig;

  constructor(config: DataClausConfig) {
    this.config = config;
  }

  async ingest(event: IngestEvent): Promise<IngestResponse> {
    const url = `${this.config.endpoint}/v1/ingest`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${this.config.apiKey}` // Future
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to ingest event: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }
}
