export class EligibleApplicationDto {
  id: string;
  name: string;
  category: string | null;
  event_count: number;
  unique_users: number;
  eligible: boolean;
  reason?: string;
}
