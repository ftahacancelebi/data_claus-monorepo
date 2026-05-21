import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PackageStatus } from '../../../common/constants';
import { DimensionsMapValued } from '../dto/dimension-payload.dto';

/**
 * `claimed_metrics` JSON shape — what the developer SAYS the package contains.
 * The LLM auditor checks this against the sample for honesty.
 */
export interface ClaimedMetrics {
  row_count: number;
  unique_users: number;
  date_range_start: string; // ISO date
  date_range_end: string;   // ISO date
}

/**
 * Field-name → declared type (free-form string so the DTO accepts arbitrary
 * developer-friendly values like "string", "iso_timestamp", "uuid").
 * The LLM evaluator inspects this verbatim.
 */
export type PackageSchema = Record<string, string>;

/**
 * Per-dimension valuation returned by the LLM evaluator when the package
 * contains extracted dimensions (behavior / demographic / device).
 * Mirrored by `DimensionValuationSchema` in `llm-evaluation.schema.ts`.
 */
export interface DimensionValuationResult {
  unit_price_usd: number;
  quality_score: number;
  ai_justification: string;
}

/**
 * The shape Claude returns. Parsed and validated by `LlmEvaluationSchema`
 * (zod) in `llm-evaluation.schema.ts`; stored as-is in `llm_evaluation`.
 */
export interface LlmEvaluation {
  trust_score: number;
  summary: string;
  red_flags: string[];
  buyer_match: string[];
  rubric: {
    schema_integrity: number;
    sample_diversity: number;
    bot_signature_absence: number;
    claim_evidence_alignment: number;
    price_fairness: number;
  };
  confidence: 'high' | 'medium' | 'low';
  verdict: 'certified' | 'rejected';
  dimensions?: {
    behavior?: DimensionValuationResult;
    demographic?: DimensionValuationResult;
    device?: DimensionValuationResult;
  };
}

@Entity('data_packages')
@Index('idx_packages_status_score', ['status', 'dataclausScore'])
@Index('idx_packages_developer', ['developerId'])
@Index('idx_packages_category', ['category'])
export class DataPackage extends BaseEntity {
  @Column({ name: 'developer_id', type: 'uuid' })
  developerId: string;

  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ name: 'claimed_metrics', type: 'jsonb' })
  claimedMetrics: ClaimedMetrics;

  @Column({ name: 'schema_json', type: 'jsonb' })
  schemaJson: PackageSchema;

  @Column({ name: 'sample_rows', type: 'jsonb' })
  sampleRows: Record<string, unknown>[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: PackageStatus,
    default: PackageStatus.PENDING,
  })
  status: PackageStatus;

  /** Weighted trust score 0–1, null until evaluated. */
  @Column({
    name: 'dataclaus_score',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  dataclausScore: number | null;

  /** Full Claude response; null until evaluator runs. */
  @Column({ name: 'llm_evaluation', type: 'jsonb', nullable: true })
  llmEvaluation: LlmEvaluation | null;

  @Column({ name: 'evaluated_at', type: 'timestamp', nullable: true })
  evaluatedAt: Date | null;

  @Column({ name: 'dimensions', type: 'jsonb', nullable: true })
  dimensions: DimensionsMapValued | null;
}
