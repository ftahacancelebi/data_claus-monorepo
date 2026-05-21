import { z } from 'zod';

/**
 * Per-dimension valuation block returned by the evaluator when the package
 * contains extracted dimensions. Mirrors `DimensionValuationResult` in
 * `entities/data-package.entity.ts`.
 */
const DimensionValuationSchema = z.object({
  unit_price_usd: z.number().min(0),
  quality_score: z.number().min(0).max(1),
  ai_justification: z.string().min(1),
});

/**
 * Strict schema for the JSON Claude returns. Parsed in
 * PackageEvaluatorService; on parse failure we retry once with a tighter
 * instruction, and if that still fails we mark the package `rejected`.
 *
 * Keep this in sync with the JSON template in `package-evaluator.prompt.ts`.
 */
export const LlmEvaluationSchema = z.object({
  trust_score: z.number().min(0).max(1),
  summary: z.string().min(20).max(400),
  red_flags: z.array(z.string().min(2).max(140)).max(8),
  buyer_match: z.array(z.string().min(2).max(60)).min(1).max(6),
  rubric: z.object({
    schema_integrity: z.number().min(0).max(1),
    sample_diversity: z.number().min(0).max(1),
    bot_signature_absence: z.number().min(0).max(1),
    claim_evidence_alignment: z.number().min(0).max(1),
    price_fairness: z.number().min(0).max(1),
  }),
  confidence: z.enum(['high', 'medium', 'low']),
  verdict: z.enum(['certified', 'rejected']),
  dimensions: z.object({
    behavior:    DimensionValuationSchema.optional(),
    demographic: DimensionValuationSchema.optional(),
    device:      DimensionValuationSchema.optional(),
  }).optional(),
});

export type LlmEvaluationParsed = z.infer<typeof LlmEvaluationSchema>;
