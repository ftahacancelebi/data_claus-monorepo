'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface ScoredEvent {
  id: string;
  event_id: string;
  developer_id: string;
  user_id: string;
  quality_score: number;
  is_human: boolean;
  jitter: number;
  time_variance: number;
  payout: number;
  processed_at: string;
}

interface EventsTableProps {
  events: ScoredEvent[];
}

export function EventsTable({ events }: EventsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event ID</TableHead>
          <TableHead>Quality Score</TableHead>
          <TableHead>Human</TableHead>
          <TableHead>Jitter</TableHead>
          <TableHead>Payout</TableHead>
          <TableHead>Processed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className="text-center text-muted-foreground"
            >
              No events found
            </TableCell>
          </TableRow>
        ) : (
          events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="font-mono text-xs">
                {event.event_id.slice(0, 12)}...
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    event.quality_score >= 0.8
                      ? 'success'
                      : event.quality_score >= 0.5
                      ? 'secondary'
                      : 'destructive'
                  }
                >
                  {(event.quality_score * 100).toFixed(1)}%
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={event.is_human ? 'success' : 'destructive'}>
                  {event.is_human ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
              <TableCell>{event.jitter.toFixed(3)}</TableCell>
              <TableCell>${event.payout.toFixed(4)}</TableCell>
              <TableCell>
                {new Date(event.processed_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
