import { DataPackage } from './entities/data-package.entity';

/**
 * Builds the user-message prompt for Claude. Keep the output schema EXACTLY
 * in sync with `LlmEvaluationSchema` (zod) — the JSON in this template is
 * the contract.
 *
 * Token budget per spec §6d: ~1500 input, ~400 output. Sample-row caps are
 * enforced upstream in DataPackagesService.assertSampleRowsValid.
 */
export function buildPrompt(pkg: DataPackage): string {
  const sampleCount = Array.isArray(pkg.sampleRows) ? pkg.sampleRows.length : 0;
  const claimedRowCount = pkg.claimedMetrics?.row_count ?? 'unknown';
  const sampleRows = JSON.stringify(pkg.sampleRows ?? [], null, 2);
  const schema = JSON.stringify(pkg.schemaJson ?? {}, null, 2);
  const claimedMetrics = JSON.stringify(pkg.claimedMetrics ?? {}, null, 2);

  const dimensionsBlock = pkg.dimensions
    ? `
DIMENSIONS PRESENT
${Object.entries(pkg.dimensions).filter(([, dim]) => dim != null).map(([name, dim]: any) => `
- ${name.toUpperCase()}: ${dim.count} units
  Schema: ${JSON.stringify(dim.schema_json)}
  Sample (first 3): ${JSON.stringify((dim.sample_rows ?? []).slice(0, 3))}
  ${dim.distribution ? `Top distribution: ${JSON.stringify(Object.entries(dim.distribution).slice(0, 5))}` : ''}
`).join('\n')}

For each dimension above, you ALSO output a per-dimension valuation. Industry anchor bands (USD per 1,000 units):
- behavior:    $1–10 per 1,000 events
- demographic: $5–50 per 1,000 profiles
- device:      $0.50–5 per 1,000 events

Quality multipliers (apply within band):
- behavior: completion rate >60% → upper band; tag diversity >30 → upper band
- demographic: completeness <80% → lower band
- device: bot-flagged fraction >10% → lower band
`
    : '';

  return `You are DataClaus AI — an independent data-quality auditor for a B2B behavioral-data marketplace.

A developer has submitted a data package. Your job: evaluate whether the package matches its claims and is suitable for sale to buyers. Be skeptical but fair.

PACKAGE
- Title: ${pkg.title}
- Category: ${pkg.category}
- Description: ${pkg.description ?? '(none)'}
- Claimed metrics: ${claimedMetrics}
- Schema: ${schema}
- Sample rows (${sampleCount} of claimed ${claimedRowCount}):
${sampleRows}
- Asking price (USD): ${pkg.price}
- Note: user IDs in sample rows are pseudonymized as \`u_<hex>\` — this is privacy hygiene, not a data quality issue.

EVALUATION RUBRIC — score each 0.0–1.0:
1. schema_integrity — field types consistent across rows, required fields present, null/anomaly rate reasonable
2. sample_diversity — distinct users/sessions, time range matches claim, values plausible
3. bot_signature_absence — flags for: repeated user-agents, sub-100ms intervals, zero jitter, dup fingerprints, suspicious round numbers
4. claim_evidence_alignment — samples actually show what title/category/metrics claim
5. price_fairness — price per row vs. category baseline (fitness ~$0.001/row, social ~$0.0003/row, finance ~$0.01/row, location ~$0.002/row, entertainment ~$0.0008/row, health ~$0.005/row, productivity ~$0.0006/row)
${dimensionsBlock}
OUTPUT — STRICT JSON only. No prose outside the JSON. No markdown fences. The first character of your reply MUST be "{".
{
  "trust_score": <weighted avg 0.0-1.0>,
  "summary": "<2 sentences buyer-facing — what makes this package useful and what to watch for>",
  "red_flags": ["<short bullet>", ...],
  "buyer_match": ["<advertiser/buyer category>", ...],
  "rubric": {
    "schema_integrity": <0-1>,
    "sample_diversity": <0-1>,
    "bot_signature_absence": <0-1>,
    "claim_evidence_alignment": <0-1>,
    "price_fairness": <0-1>
  },
  "confidence": "high" | "medium" | "low",
  "verdict": "certified" | "rejected",
  "dimensions": {
    "behavior":    { "unit_price_usd": <float, anchored to band>, "quality_score": <0-1>, "ai_justification": "<1 sentence>" },
    "demographic": { "unit_price_usd": <float>, "quality_score": <0-1>, "ai_justification": "<1 sentence>" },
    "device":      { "unit_price_usd": <float>, "quality_score": <0-1>, "ai_justification": "<1 sentence>" }
  }
}

The "dimensions" field is OPTIONAL — include ONLY the dimensions actually listed in the "DIMENSIONS PRESENT" section above. If no dimensions were listed, omit the "dimensions" field entirely.`;
}

/**
 * Stricter retry prompt — appended when the first response fails JSON parse.
 * Quotes the schema fields by name and demands the literal `{`.
 */
export function buildRetryPrompt(originalPrompt: string, errorReason: string): string {
  return `${originalPrompt}

YOUR PREVIOUS RESPONSE WAS REJECTED: ${errorReason}

Output JSON ONLY. No explanation, no markdown, no backticks.
First character must be "{". Final character must be "}".
All numeric fields must be JSON numbers in [0, 1]. All required keys must be present:
trust_score, summary, red_flags, buyer_match, rubric { schema_integrity, sample_diversity, bot_signature_absence, claim_evidence_alignment, price_fairness }, confidence, verdict.`;
}
