'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCreatePackage } from '@/lib/api-hooks';
import { RequireRole } from '@/lib/route-guards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api';

const CATEGORY_OPTIONS = [
  'fitness',
  'social',
  'finance',
  'entertainment',
  'location',
  'health',
  'productivity',
  'other',
];

const DEFAULT_SCHEMA_JSON = JSON.stringify(
  {
    user_id: 'string',
    session_seconds: 'number',
    activity_type: 'string',
    recorded_at: 'timestamp',
  },
  null,
  2,
);

const DEFAULT_SAMPLE_ROWS = JSON.stringify(
  [
    {
      user_id: 'u_a8c1',
      session_seconds: 312,
      activity_type: 'run',
      recorded_at: '2025-10-04T07:14:21Z',
    },
    {
      user_id: 'u_91ec',
      session_seconds: 188,
      activity_type: 'cycle',
      recorded_at: '2025-10-04T08:02:11Z',
    },
    {
      user_id: 'u_5fa0',
      session_seconds: 905,
      activity_type: 'gym',
      recorded_at: '2025-10-04T19:30:00Z',
    },
    {
      user_id: 'u_c2d9',
      session_seconds: 421,
      activity_type: 'walk',
      recorded_at: '2025-10-05T06:55:43Z',
    },
    {
      user_id: 'u_77bb',
      session_seconds: 250,
      activity_type: 'run',
      recorded_at: '2025-10-05T18:11:09Z',
    },
  ],
  null,
  2,
);

function NewPackageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const create = useCreatePackage();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('fitness');
  const [description, setDescription] = useState('');
  const [rowCount, setRowCount] = useState(12500);
  const [uniqueUsers, setUniqueUsers] = useState(1820);
  const [dateStart, setDateStart] = useState('2025-09-01');
  const [dateEnd, setDateEnd] = useState('2025-10-31');
  const [price, setPrice] = useState(49.99);
  const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA_JSON);
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_ROWS);

  const parsedSchema = useMemo(() => {
    try {
      const v = JSON.parse(schemaText);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return { ok: true as const, value: v as Record<string, string> };
      }
      return { ok: false as const, error: 'Schema must be a JSON object.' };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [schemaText]);

  const parsedSamples = useMemo(() => {
    try {
      const v = JSON.parse(sampleText);
      if (!Array.isArray(v)) {
        return { ok: false as const, error: 'Sample rows must be a JSON array.' };
      }
      if (v.length < 5 || v.length > 10) {
        return {
          ok: false as const,
          error: `Need 5–10 sample rows (you have ${v.length}).`,
        };
      }
      return { ok: true as const, value: v as Record<string, unknown>[] };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [sampleText]);

  const formValid =
    title.trim().length >= 8 &&
    rowCount > 0 &&
    uniqueUsers > 0 &&
    price > 0 &&
    parsedSchema.ok &&
    parsedSamples.ok;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsedSchema.ok || !parsedSamples.ok) return;
    try {
      const res = await create.mutateAsync({
        title: title.trim(),
        category,
        description: description || undefined,
        claimed_metrics: {
          row_count: rowCount,
          unique_users: uniqueUsers,
          date_range_start: dateStart,
          date_range_end: dateEnd,
        },
        schema_json: parsedSchema.value,
        sample_rows: parsedSamples.value,
        price: Number(price),
      });
      toast({
        title: 'Submitted',
        description: 'DataClaus AI is evaluating your package…',
      });
      router.push(`/dashboard/packages/${res.id}`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to submit package';
      toast({ title: 'Submission failed', description: message });
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <Link
          href="/dashboard/packages"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to packages
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mt-2">
          Submit a Data Package
        </h1>
        <p className="text-slate-500 mt-1">
          Our AI auditor reviews each package before it&apos;s listed in the marketplace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="glass-panel border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="iOS Fitness Engagement Sessions Q4 2025"
                minLength={8}
                maxLength={200}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={2000}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="What the data covers and how it was collected."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Claimed Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="row_count">Row count</Label>
                <Input
                  id="row_count"
                  type="number"
                  min="1"
                  value={rowCount}
                  onChange={(e) => setRowCount(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="unique_users">Unique users</Label>
                <Input
                  id="unique_users"
                  type="number"
                  min="1"
                  value={uniqueUsers}
                  onChange={(e) => setUniqueUsers(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="date_start">Date range start</Label>
                <Input
                  id="date_start"
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="date_end">Date range end</Label>
                <Input
                  id="date_end"
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Schema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="schema">Field-name → type (JSON object)</Label>
            <textarea
              id="schema"
              value={schemaText}
              onChange={(e) => setSchemaText(e.target.value)}
              rows={6}
              className="font-mono text-xs flex w-full rounded-md border border-input bg-background px-3 py-2"
            />
            {!parsedSchema.ok && (
              <p className="text-xs text-red-600">{parsedSchema.error}</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Sample Rows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="samples">5–10 rows (JSON array)</Label>
            <textarea
              id="samples"
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              rows={12}
              className="font-mono text-xs flex w-full rounded-md border border-input bg-background px-3 py-2"
            />
            {!parsedSamples.ok && (
              <p className="text-xs text-red-600">{parsedSamples.error}</p>
            )}
            {parsedSamples.ok && (
              <p className="text-xs text-slate-500">
                {parsedSamples.value.length} rows · enough for AI audit
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            By submitting, you confirm the data is collected with user consent.
          </p>
          <Button type="submit" disabled={!formValid || create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit for AI Evaluation'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewPackagePage() {
  return (
    <RequireRole role={['developer', 'admin']}>
      <NewPackageContent />
    </RequireRole>
  );
}
