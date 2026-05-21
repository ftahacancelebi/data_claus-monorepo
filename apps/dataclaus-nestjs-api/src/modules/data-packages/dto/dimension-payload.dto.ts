import { DimensionName } from '../extractor/dimensions.constants';

export interface DimensionPayload {
  count: number;
  sample_rows: Record<string, unknown>[];
  distribution?: Record<string, number>;
  schema_json: Record<string, string>;
}

export interface DimensionValuation {
  unit_price_usd: number;
  quality_score: number;
  ai_justification: string;
}

export type DimensionPayloadWithValuation = DimensionPayload & DimensionValuation & {
  total_usd: number;
};

export type DimensionsMap = Partial<Record<DimensionName, DimensionPayload>>;
export type DimensionsMapValued = Partial<Record<DimensionName, DimensionPayloadWithValuation>>;
