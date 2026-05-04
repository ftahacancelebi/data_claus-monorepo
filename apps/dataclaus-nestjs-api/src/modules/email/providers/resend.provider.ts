import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailMessage, EmailProvider } from '../email.types';

/**
 * Resend (resend.com) email provider.
 *
 * Activated when EMAIL_PROVIDER=resend and RESEND_API_KEY is set.
 * Falls back to throwing in production-mode misconfiguration.
 */
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email/Resend');
  private readonly apiKey: string | undefined;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY');
    this.fromAddress =
      this.config.get<string>('EMAIL_FROM') ?? 'noreply@dataclaus.local';
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'RESEND_API_KEY is not configured',
      );
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Resend API ${res.status}: ${text}`);
      throw new InternalServerErrorException('Email delivery failed');
    }
  }
}
