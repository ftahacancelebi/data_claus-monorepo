export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
