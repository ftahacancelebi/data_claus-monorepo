import { PayoutMethod, PayoutStatus } from '../../../common/constants';

export class PayoutResponseDto {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  status: PayoutStatus;
  requested_at: Date;
  approved_at: Date | null;
  completed_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown> | null;
}
