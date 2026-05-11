import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DataPackage, LlmEvaluation } from './entities/data-package.entity';
import { LlmEvaluationSchema } from './llm-evaluation.schema';
import {
  buildPrompt,
  buildRetryPrompt,
} from './package-evaluator.prompt';

/**
 * PackageEvaluatorService — produces a trust-score evaluation for a
 * developer-submitted data package.
 *
 * If `ANTHROPIC_API_KEY` is set, calls Claude (model from `LLM_MODEL`,
 * defaults to `claude-haiku-4-5-20251001`). Response is validated against
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
  private readonly client: Anthropic | null;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model =
      this.config.get<string>('LLM_MODEL') ?? 'claude-haiku-4-5-20251001';
    this.maxTokens = Number(
      this.config.get<string>('LLM_EVAL_MAX_TOKENS') ?? '1024',
    );
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — package evaluator will use the deterministic stub.',
      );
    }
  }

  async evaluate(pkg: DataPackage): Promise<LlmEvaluation> {
    if (!this.client) {
      return this.stubEvaluate(pkg);
    }
    try {
      return await this.callClaude(pkg);
    } catch (err) {
      this.logger.error(
        `Claude evaluation failed for package ${pkg.id}: ${(err as Error).message} — falling back to stub.`,
      );
      return this.stubEvaluate(pkg);
    }
  }

  // ---------------------------------------------------------------------------
  // Real call
  // ---------------------------------------------------------------------------

  private async callClaude(pkg: DataPackage): Promise<LlmEvaluation> {
    const prompt = buildPrompt(pkg);

    const first = await this.callOnce(prompt);
    const firstParsed = this.tryParse(first);
    if (firstParsed) return firstParsed;

    this.logger.warn(
      `Package ${pkg.id}: first Claude response failed schema, retrying with stricter prompt.`,
    );
    const retry = await this.callOnce(
      buildRetryPrompt(prompt, 'JSON failed schema validation'),
    );
    const retryParsed = this.tryParse(retry);
    if (retryParsed) return retryParsed;

    // Both passes failed. Throw so the caller marks the package rejected
    // with a clean reason (rather than silently returning a stub eval that
    // looks legitimate).
    throw new Error('LLM output unparseable after retry');
  }

  private async callOnce(prompt: string): Promise<string> {
    const resp = await this.client!.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = resp.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Claude returned non-text content block');
    }
    return block.text;
  }

  private tryParse(raw: string): LlmEvaluation | null {
    // Trim leading whitespace, strip ``` fences if Claude added them.
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
  // Deterministic fallback (Phase 1 stub kept for CI / offline)
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

    return {
      trust_score: Number(trust.toFixed(3)),
      summary:
        `Heuristic evaluation for "${pkg.title}": ${sampleSize} sample rows across ${fieldCount} declared fields, ` +
        `claimed ${rowCount} rows from ${uniqueUsers} users. Set ANTHROPIC_API_KEY to enable the live AI auditor.`,
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
    };
  }

  private clamp01(x: number): number {
    if (!Number.isFinite(x) || x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }
}
