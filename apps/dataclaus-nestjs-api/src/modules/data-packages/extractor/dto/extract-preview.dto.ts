import { DimensionsMap } from '../../dto/dimension-payload.dto';

export class ExtractedPackageDraftDto {
  // These map 1:1 to CreatePackageDto — submit directly to POST /v1/packages
  title: string;
  category: string;
  claimed_metrics: {
    row_count: number;
    unique_users: number;
    date_range_start: string;
    date_range_end: string;
  };
  schema_json: Record<string, string>;
  sample_rows: Array<Record<string, unknown>>;
  price: number;
  application_id: string;

  // UI-only metadata — ignored by POST /v1/packages
  ui_meta: {
    application_name: string;
    suggested_price_basis: string;
    flagged_sample_count: number;
    coverage_warning?: string;
  };

  // Multi-dimension payload. Optional for backward compat; lives alongside the
  // flat fields above. Apps without behavior/demographic only get `device`.
  dimensions?: DimensionsMap;
}
