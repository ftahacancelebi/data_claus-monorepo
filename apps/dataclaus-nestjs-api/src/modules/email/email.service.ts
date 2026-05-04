import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_PROVIDER, EmailMessage, EmailProvider } from './email.types';

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  send(message: EmailMessage): Promise<void> {
    return this.provider.send(message);
  }

  sendOtp(to: string, code: string, ttlMinutes = 5): Promise<void> {
    return this.send({
      to,
      subject: 'DataClaus — Tek Kullanımlık Giriş Kodunuz',
      html: this.renderOtpHtml(code, ttlMinutes),
      text: `DataClaus giriş kodunuz: ${code} (${ttlMinutes} dakika geçerli)`,
    });
  }

  private renderOtpHtml(code: string, ttlMinutes: number): string {
    return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#0b0f1a;color:#e6edf7;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#111827;border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:20px;">DataClaus Girişi</h1>
    <p style="margin:0 0 24px;color:#9aa4b2;line-height:1.5;">
      Hesabınıza giriş yapmak için aşağıdaki kodu kullanın:
    </p>
    <div style="font-size:32px;letter-spacing:8px;font-weight:700;background:#1f2937;border-radius:8px;padding:16px;text-align:center;">
      ${code}
    </div>
    <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">
      Bu kod ${ttlMinutes} dakika boyunca geçerlidir. Bu girişi siz başlatmadıysanız e-postayı yok sayın.
    </p>
  </div>
</body></html>`;
  }
}
