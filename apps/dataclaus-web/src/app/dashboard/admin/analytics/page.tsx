'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import {
  getAnalyticsEvents,
  getDashboard,
  type DashboardStats,
} from '@/lib/api';
import type { ScoredEvent } from '@/lib/types';
import { Activity, Users, BarChart3, TrendingUp } from 'lucide-react';

export default function AdminAnalyticsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<ScoredEvent[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsData, statsData] = await Promise.all([
          getAnalyticsEvents(50).catch(() => []),
          getDashboard().catch(() => null),
        ]);
        setEvents(eventsData as ScoredEvent[]);
        setStats(statsData);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (!user || user.role !== 'admin') {
    return <div className="p-4">Access denied</div>;
  }

  const avgQuality =
    events.length > 0
      ? events.reduce((sum, e) => sum + e.quality_score, 0) / events.length
      : 0;
  const humanEvents = events.filter((e) => e.is_human).length;
  const totalPayouts = events.reduce((sum, e) => sum + e.payout, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Platform analytics and event data
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_events?.toLocaleString() ?? events.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Quality</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(avgQuality * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Human Verified
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events.length > 0
                ? ((humanEvents / events.length) * 100).toFixed(1)
                : 0}
              %
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPayouts.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scored Events</CardTitle>
          <CardDescription>Recent quality-scored data events</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event ID</TableHead>
                  <TableHead>Developer</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Quality</TableHead>
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
                      colSpan={8}
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
                      <TableCell className="font-mono text-xs">
                        {event.developer_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.user_id.slice(0, 8)}...
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
                        <Badge
                          variant={event.is_human ? 'success' : 'destructive'}
                        >
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
