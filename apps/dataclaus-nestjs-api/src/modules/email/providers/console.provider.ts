import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailProvider } from '../email.types';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email/Console');

  async send(message: EmailMessage): Promise<void> {
    const preview = message.text ?? this.stripHtml(message.html);
    this.logger.log(`To: ${message.to} | Subject: ${message.subject}`);
    this.logger.log(`Body: ${preview}`);
    return Promise.resolve();
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
