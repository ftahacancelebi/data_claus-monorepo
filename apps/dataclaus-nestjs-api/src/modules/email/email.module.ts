import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EMAIL_PROVIDER, EmailProvider } from './email.types';
import { ConsoleEmailProvider } from './providers/console.provider';
import { ResendEmailProvider } from './providers/resend.provider';

const emailProvider: Provider = {
  provide: EMAIL_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): EmailProvider => {
    const driver = (
      config.get<string>('EMAIL_PROVIDER') ?? 'console'
    ).toLowerCase();
    if (driver === 'resend') {
      return new ResendEmailProvider(config);
    }
    return new ConsoleEmailProvider();
  },
};

@Module({
  imports: [ConfigModule],
  providers: [emailProvider, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
