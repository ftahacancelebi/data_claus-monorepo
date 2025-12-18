'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  Users,
} from 'lucide-react';

export default function AdminReportsPage() {
  const { user } = useAuth();

  if (!user || user.role !== 'admin') {
    return <div className="p-4">Access denied</div>;
  }

  const reports = [
    {
      name: 'Monthly Revenue Report',
      description: 'Revenue breakdown by source',
      icon: DollarSign,
      period: 'December 2024',
    },
    {
      name: 'User Growth Report',
      description: 'New user registrations and retention',
      icon: Users,
      period: 'Q4 2024',
    },
    {
      name: 'Transaction Summary',
      description: 'All platform transactions',
      icon: TrendingUp,
      period: 'Last 30 days',
    },
    {
      name: 'Developer Performance',
      description: 'App performance and earnings',
      icon: FileText,
      period: 'November 2024',
    },
    {
      name: 'Campaign Analytics',
      description: 'Ad campaign performance metrics',
      icon: TrendingUp,
      period: 'Last 7 days',
    },
    {
      name: 'Data Quality Report',
      description: 'Event quality scores and trends',
      icon: FileText,
      period: 'Weekly',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Generate and download platform reports
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.name}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-muted rounded-lg">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {report.period}
                  </div>
                </div>
                <CardTitle className="text-lg mt-3">{report.name}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custom Report</CardTitle>
          <CardDescription>
            Generate a custom report with specific parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Report Type</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option>Transaction Report</option>
                <option>User Report</option>
                <option>Revenue Report</option>
                <option>Campaign Report</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <input
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <input
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
