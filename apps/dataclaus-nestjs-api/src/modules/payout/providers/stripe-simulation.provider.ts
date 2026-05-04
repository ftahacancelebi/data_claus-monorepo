import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayoutMethod } from '../../../common/constants';

export interface StripePayoutAttempt {
  payoutId: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  destination?: string;
}

export interface StripePayoutResult {
  ok: boolean;
  providerReference: string;
  message: string;
  simulated: boolean;
  durationMs: number;
}

/**
 * Capstone-mode payout provider. With STRIPE_SIMULATION=true (default in
 * dev) it sleeps a short interval and returns success ~95% of the time so
 * the rejection path is also demoable. With STRIPE_SIMULATION=false a
 * real Stripe / banking gateway integration would replace this — out of
 * capstone scope (Phase 7+).
 */
@Injectable()
export class StripeSimulationProvider {
  private readonly logger = new Logger(StripeSimulationProvider.name);

  constructor(private readonly configService: ConfigService) {}

  isSimulated(): boolean {
    const flag = this.configService.get<string>('STRIPE_SIMULATION');
    if (flag === undefined) return true;
    return flag !== 'false' && flag !== '0';
  }

  async sendPayout(attempt: StripePayoutAttempt): Promise<StripePayoutResult> {
    const start = Date.now();

    if (!this.isSimulated()) {
      throw new Error(
        'Real Stripe integration not configured. Set STRIPE_SIMULATION=true.',
      );
    }

    const delayMs = 1500 + Math.floor(Math.random() * 1000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const successRoll = Math.random();
    const ok = successRoll < 0.95;
    const providerReference = `sim_${attempt.payoutId.slice(0, 8)}_${Date.now().toString(36)}`;

    if (!ok) {
      this.logger.warn(
        `Simulated provider declined payout ${attempt.payoutId} (roll=${successRoll.toFixed(3)})`,
      );
      return {
        ok: false,
        providerReference,
        message: 'simulated_provider_declined',
        simulated: true,
        durationMs: Date.now() - start,
      };
    }

    this.logger.log(
      `Simulated provider accepted payout ${attempt.payoutId} ($${attempt.amount.toFixed(4)} ${attempt.currency})`,
    );
    return {
      ok: true,
      providerReference,
      message: 'simulated_provider_accepted',
      simulated: true,
      durationMs: Date.now() - start,
    };
  }
}
