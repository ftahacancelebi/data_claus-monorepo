'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Sparkle,
  ArrowRight,
  ArrowLeft,
  Warning,
  CircleNotch,
  Database,
} from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEligibleApplications, useExtractPreview, useCreatePackage } from '@/lib/api-hooks';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { EligibleApplication, ExtractedPackageDraft } from '@/lib/schemas';
import { DimensionGrid } from '@/components/marketplace/DimensionGrid';

interface Props {
  open: boolean;
  onClose: () => void;
}

const DATE_RANGE_OPTIONS = [
  { label: 'Last 7 days',  days: 7  },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export function CreateFromAppModal({ open, onClose }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<'pick' | 'preview'>('pick');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [draft, setDraft] = useState<ExtractedPackageDraft | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');

  const { data: apps, isLoading: appsLoading } = useEligibleApplications();
  const extractMutation = useExtractPreview();
  const createMutation = useCreatePackage();

  function resetAndClose() {
    setStep('pick');
    setSelectedAppId(null);
    setDraft(null);
    setTitle('');
    setPrice('');
    onClose();
  }

  async function handleExtract() {
    if (!selectedAppId) return;
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    try {
      const result = await extractMutation.mutateAsync({
        appId: selectedAppId,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setDraft(result);
      setTitle(result.title);
      setPrice(String(result.price));
      setStep('preview');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to extract preview';
      toast({ title: 'Extraction failed', description: msg });
    }
  }

  async function handleSubmit() {
    if (!draft) return;
    try {
      const res = await createMutation.mutateAsync({
        title: title.trim() || draft.title,
        category: draft.category,
        description: undefined,
        claimed_metrics: draft.claimed_metrics,
        schema_json: draft.schema_json,
        sample_rows: draft.sample_rows,
        price: parseFloat(price) || draft.price,
        application_id: draft.application_id,
      });
      toast({ title: 'Submitted', description: 'DataClaus AI is evaluating your package…' });
      resetAndClose();
      router.push(`/dashboard/packages/${res.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Submission failed';
      toast({ title: 'Submit failed', description: msg });
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && resetAndClose()}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Sparkle weight="fill" className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-semibold text-slate-900 text-sm tracking-tight">
                  {step === 'pick' ? 'Select an application' : 'Package preview'}
                </span>
              </div>
              <button
                onClick={resetAndClose}
                className="text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Close"
              >
                <X weight="bold" className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1 — App picker */}
            {step === 'pick' && (
              <div className="px-6 py-5 space-y-5">
                {appsLoading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm py-6 justify-center">
                    <CircleNotch className="w-4 h-4 animate-spin" />
                    Loading your apps…
                  </div>
                ) : (apps ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">
                    No apps found.{' '}
                    <a href="/dashboard/my-apps" className="text-slate-900 underline">Create one</a> first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(apps ?? []).map((app: EligibleApplication) => (
                      <label
                        key={app.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          app.eligible
                            ? selectedAppId === app.id
                              ? 'border-slate-900 bg-slate-50'
                              : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/50'
                            : 'border-slate-100 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <input
                          type="radio"
                          name="app"
                          value={app.id}
                          disabled={!app.eligible}
                          checked={selectedAppId === app.id}
                          onChange={() => setSelectedAppId(app.id)}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedAppId === app.id ? 'border-slate-900' : 'border-slate-300'
                        }`}>
                          {selectedAppId === app.id && (
                            <div className="w-2 h-2 rounded-full bg-slate-900" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 truncate">{app.name}</span>
                            {app.category && (
                              <span className="text-xs text-slate-400 font-mono">{app.category}</span>
                            )}
                          </div>
                          {app.eligible ? (
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="font-mono text-xs text-slate-500">
                                {app.unique_users.toLocaleString()} users
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-xs text-slate-500">
                                {app.event_count.toLocaleString()} events
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 mt-0.5">{app.reason}</p>
                          )}
                        </div>
                        <Database weight="duotone" className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </label>
                    ))}
                  </div>
                )}

                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Date range</Label>
                  <div className="flex gap-2">
                    {DATE_RANGE_OPTIONS.map(opt => (
                      <button
                        key={opt.days}
                        onClick={() => setRangeDays(opt.days)}
                        className={`flex-1 text-xs py-1.5 px-2 rounded-lg border transition-all ${
                          rangeDays === opt.days
                            ? 'border-slate-900 bg-slate-900 text-white font-medium'
                            : 'border-slate-200 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    disabled={!selectedAppId || extractMutation.isPending}
                    onClick={handleExtract}
                    className="gap-1.5"
                  >
                    {extractMutation.isPending ? (
                      <>
                        <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                        Extracting…
                      </>
                    ) : (
                      <>
                        Extract preview
                        <ArrowRight weight="bold" className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2 — Preview */}
            {step === 'preview' && draft && (
              <div className="px-6 py-5 space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: draft.claimed_metrics.row_count.toLocaleString(), label: 'rows' },
                    { value: draft.claimed_metrics.unique_users.toLocaleString(), label: 'unique users' },
                    {
                      value: `${draft.claimed_metrics.date_range_start.slice(0, 10)} → ${draft.claimed_metrics.date_range_end.slice(5, 10)}`,
                      label: 'date range',
                    },
                  ].map(({ value, label }) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3">
                      <p className="font-mono text-sm font-semibold text-slate-900 leading-tight truncate">{value}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                    Sample rows ({draft.sample_rows.length})
                    {draft.ui_meta.flagged_sample_count > 0 && (
                      <span className="ml-2 text-amber-600 normal-case">
                        · {draft.ui_meta.flagged_sample_count} flagged
                      </span>
                    )}
                  </p>
                  {draft.dimensions && Object.keys(draft.dimensions).length > 0 ? (
                    <DimensionGrid dimensions={draft.dimensions} />
                  ) : (
                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-3 py-2 font-mono text-slate-400 font-normal">user_pseudo_id</th>
                            <th className="text-left px-3 py-2 font-mono text-slate-400 font-normal">event_type</th>
                            <th className="text-right px-3 py-2 font-mono text-slate-400 font-normal">quality</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draft.sample_rows.map((row, i) => {
                            const qs = typeof row.quality_score === 'number'
                              ? row.quality_score
                              : parseFloat(String(row.quality_score ?? 0));
                            const flagged = qs < 0.3;
                            return (
                              <tr
                                key={i}
                                className={`border-b border-slate-50 last:border-0 ${flagged ? 'bg-amber-50/60' : ''}`}
                              >
                                <td className="px-3 py-1.5 font-mono text-slate-600 truncate max-w-[140px]">
                                  {String(row.user_pseudo_id ?? '')}
                                </td>
                                <td className="px-3 py-1.5 text-slate-700">
                                  {String(row.event_type ?? '')}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <span className={`font-mono ${flagged ? 'text-amber-700' : 'text-slate-600'}`}>
                                    {qs.toFixed(2)}
                                    {flagged && (
                                      <Warning weight="fill" className="inline w-3 h-3 ml-1 text-amber-500" />
                                    )}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="pkg-title" className="text-xs text-slate-500">Title</Label>
                    <Input
                      id="pkg-title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="mt-1 font-medium"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pkg-price" className="text-xs text-slate-500">
                      Price (USD)
                      <span className="ml-2 font-normal text-slate-400 text-xs">{draft.ui_meta.suggested_price_basis}</span>
                    </Label>
                    <Input
                      id="pkg-price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setStep('pick')}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <ArrowLeft weight="bold" className="w-3 h-3" />
                    Back
                  </button>
                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || !title.trim() || parseFloat(price) <= 0}
                    className="gap-1.5"
                  >
                    {createMutation.isPending ? (
                      <>
                        <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      'Submit for AI Evaluation →'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
