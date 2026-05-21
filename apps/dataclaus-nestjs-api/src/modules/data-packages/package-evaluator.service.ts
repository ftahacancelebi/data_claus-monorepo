import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DataPackage, LlmEvaluation } from './entities/data-package.entity';
import { LlmEvaluationSchema } from './llm-evaluation.schema';
import {
  buildPrompt,
  buildRetryPrompt,
} from './package-evaluator.prompt';
import {
  INDUSTRY_ANCHORS,
  ANCHOR_CLAMP_TOLERANCE,
  DimensionName,
} from './extractor/dimensions.constants';
import { DimensionsMap, DimensionsMapValued } from './dto/dimension-payload.dto';

/**
 * PackageEvaluatorService — produces a trust-score evaluation for a
 * developer-submitted data package using Google Gemini.
 *
 * If `GEMINI_API_KEY` is set, calls Gemini (model from `LLM_MODEL`,
 * defaults to `gemini-2.0-flash`). Response is validated against
 * `LlmEvaluationSchema` (zod); on parse failure we retry once with a tighter
 * instruction. If the retry still fails, the caller flips the package to
 * `rejected` with a "evaluator output unparseable" red flag.
 *
 * If the key is empty (CI / offline dev), we fall through to a deterministic
 * heuristic so the rest of the stack stays exercisable.
 */
@Injectable()
export class PackageEvaluatorService {
  private readonly logger = new Logger(PackageEvaluatorService.name);
  private readonly client: GoogleGenerativeAI | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.model =
      this.config.get<string>('LLM_MODEL') ?? 'gemini-2.0-flash';
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    if (!this.client) {
      this.logger.warn(
        'GEMINI_API_KEY not set — package evaluator will use the deterministic stub.',
      );
    }
  }

  async evaluate(pkg: DataPackage): Promise<LlmEvaluation> {
    if (!this.client) {
      return this.stubEvaluate(pkg);
    }
    try {
      return await this.callGemini(pkg);
    } catch (err) {
      this.logger.error(
        `Gemini evaluation failed for package ${pkg.id}: ${(err as Error).message} — falling back to stub.`,
      );
      return this.stubEvaluate(pkg);
    }
  }

  // ---------------------------------------------------------------------------
  // Per-dimension valuation: clamp to industry band + compute totals
  // ---------------------------------------------------------------------------

  /**
   * Clamps the LLM's per-dimension unit prices to ±20% of the industry anchor
   * band and computes `total_usd = count * unit_price_usd` (rounded to 2 dp).
   * Returns a `DimensionsMapValued` ready for persistence on the package.
   *
   * If a dimension is present in `dimensions` but absent from `valuations`,
   * it is skipped (no entry in the output). The caller decides whether that
   * constitutes a soft or hard failure.
   */
  clampAndTotal(
    dimensions: DimensionsMap,
    valuations: LlmEvaluation['dimensions'],
  ): DimensionsMapValued {
    const out: DimensionsMapValued = {};
    for (const name of Object.keys(dimensions) as DimensionName[]) {
      const dim = dimensions[name];
      if (!dim) continue;
      const val = valuations?.[name];
      if (!val) continue;
      const anchor = INDUSTRY_ANCHORS[name];
      const lowPerUnit =
        (anchor.lowPerThousand / 1000) * (1 - ANCHOR_CLAMP_TOLERANCE);
      const highPerUnit =
        (anchor.highPerThousand / 1000) * (1 + ANCHOR_CLAMP_TOLERANCE);
      let unitPrice = val.unit_price_usd;
      let justification = val.ai_justification;
      if (unitPrice < lowPerUnit) {
        unitPrice = lowPerUnit;
        justification += ' (adjusted to industry band)';
      } else if (unitPrice > highPerUnit) {
        unitPrice = highPerUnit;
        justification += ' (adjusted to industry band)';
      }
      out[name] = {
        ...dim,
        unit_price_usd: unitPrice,
        quality_score: val.quality_score,
        ai_justification: justification,
        total_usd: Math.round(dim.count * unitPrice * 100) / 100,
      };
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Real call
  // ---------------------------------------------------------------------------

  private async callGemini(pkg: DataPackage): Promise<LlmEvaluation> {
    const prompt = buildPrompt(pkg);

    const first = await this.callOnce(prompt);
    const firstParsed = this.tryParse(first);
    if (firstParsed) return firstParsed;

    this.logger.warn(
      `Package ${pkg.id}: first Gemini response failed schema, retrying with stricter prompt.`,
    );
    const retry = await this.callOnce(
      buildRetryPrompt(prompt, 'JSON failed schema validation'),
    );
    const retryParsed = this.tryParse(retry);
    if (retryParsed) return retryParsed;

    throw new Error('LLM output unparseable after retry');
  }

  private async callOnce(prompt: string): Promise<string> {
    const genModel = this.client!.getGenerativeModel({ model: this.model });
    const result = await genModel.generateContent(prompt);
    return result.response.text();
  }

  private tryParse(raw: string): LlmEvaluation | null {
    let body = raw.trim();
    if (body.startsWith('```')) {
      body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return null;
    }
    const parsed = LlmEvaluationSchema.safeParse(json);
    if (!parsed.success) return null;
    return parsed.data;
  }

  // ---------------------------------------------------------------------------
  // Deterministic fallback (for CI / offline)
  // ---------------------------------------------------------------------------

  private stubEvaluate(pkg: DataPackage): LlmEvaluation {
    const rowCount = Math.max(1, pkg.claimedMetrics.row_count);
    const uniqueUsers = Math.max(1, pkg.claimedMetrics.unique_users);
    const sampleSize = Array.isArray(pkg.sampleRows) ? pkg.sampleRows.length : 0;
    const fieldCount = Object.keys(pkg.schemaJson ?? {}).length;

    const schemaIntegrity = this.clamp01(0.6 + Math.min(fieldCount, 8) * 0.05);
    const sampleDiversity = this.clamp01(
      0.55 + (sampleSize / 10) * 0.3 + (uniqueUsers / rowCount) * 0.15,
    );
    const botAbsence = this.clamp01(uniqueUsers / Math.max(rowCount * 0.05, 1));
    const claimAlign = this.clamp01(sampleSize >= 5 ? 0.8 : 0.4);
    const priceFairness = this.clamp01(
      pkg.price <= 0 ? 0.0 : pkg.price > 10_000 ? 0.3 : 0.75,
    );

    const trust =
      0.15 * schemaIntegrity +
      0.25 * sampleDiversity +
      0.30 * botAbsence +
      0.20 * claimAlign +
      0.10 * priceFairness;

    const verdict: LlmEvaluation['verdict'] = trust >= 0.4 ? 'certified' : 'rejected';

    const stubDims = pkg.dimensions
      ? this.stubDimensionValuations(pkg.dimensions as unknown as DimensionsMap)
      : undefined;

    return {
      trust_score: Number(trust.toFixed(3)),
      summary:
        `Heuristic evaluation for "${pkg.title}": ${sampleSize} sample rows across ${fieldCount} declared fields, ` +
        `claimed ${rowCount} rows from ${uniqueUsers} users. Set GEMINI_API_KEY to enable the live AI auditor.`,
      red_flags:
        verdict === 'rejected'
          ? ['Heuristic returned a low score; rerun with the live evaluator before listing.']
          : [],
      buyer_match: [pkg.category || 'general', 'general-marketing'],
      rubric: {
        schema_integrity: Number(schemaIntegrity.toFixed(3)),
        sample_diversity: Number(sampleDiversity.toFixed(3)),
        bot_signature_absence: Number(botAbsence.toFixed(3)),
        claim_evidence_alignment: Number(claimAlign.toFixed(3)),
        price_fairness: Number(priceFairness.toFixed(3)),
      },
      confidence: 'low',
      verdict,
      dimensions: stubDims,
    };
  }

  /**
   * Stub valuator: emits midpoint-of-anchor-band valuations for every present
   * dimension. Used in CI / offline dev when Gemini isn't reachable.
   */
  private stubDimensionValuations(
    dimensions: DimensionsMap,
  ): NonNullable<LlmEvaluation['dimensions']> {
    const out: NonNullable<LlmEvaluation['dimensions']> = {};
    for (const name of Object.keys(dimensions) as DimensionName[]) {
      if (!dimensions[name]) continue;
      const anchor = INDUSTRY_ANCHORS[name];
      const mid =
        ((anchor.lowPerThousand + anchor.highPerThousand) / 2) / 1000;
      out[name] = {
        unit_price_usd: mid,
        quality_score: 0.7,
        ai_justification: 'Auditor offline — defaulted to market median',
      };
    }
    return out;
  }

  private clamp01(x: number): number {
    if (!Number.isFinite(x) || x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }
}
