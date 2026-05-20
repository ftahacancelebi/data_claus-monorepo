'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMyPackages } from '@/lib/api-hooks';
import { RequireRole } from '@/lib/route-guards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataclausScoreGauge } from '@/components/packages/score-gauge';
import { ErrorPanel } from '@/components/layout/error-panel';
import { CreateFromAppModal } from '@/components/packages/CreateFromAppModal';
import { Package, Database, Clock } from 'lucide-react';
import type { DataPackage } from '@/lib/api';

function statusVariant(status: DataPackage['status']) {
  switch (status) {
    case 'certified':
    case 'sold':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'evaluating':
    case 'pending':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'rejected':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'delisted':
      return 'bg-slate-50 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

function PackagesContent() {
  const { data, isLoading, isError, error, refetch } = useMyPackages();
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-slate-100 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorPanel error={error} reset={() => void refetch()} />;
  }

  const packages = data ?? [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Data Packages
          </h1>
          <p className="text-slate-500 mt-1">
            Submit datasets for AI evaluation and listing on the marketplace.
          </p>
        </div>
        <div className="relative">
          <div className="flex">
            <Button
              onClick={() => setModalOpen(true)}
              className="rounded-r-none border-r border-white/20"
            >
              ✨ From an app
            </Button>
            <div className="relative">
              <Button
                variant="outline"
                className="rounded-l-none border-l-0 px-2"
                onClick={() => setDropdownOpen(v => !v)}
                aria-label="More options"
              >
                <svg viewBox="0 0 12 12" width={12} height={12} fill="currentColor">
                  <path d="M6 8L1 3h10L6 8z"/>
                </svg>
              </Button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 min-w-[160px]">
                  <Link
                    href="/dashboard/packages/new"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setDropdownOpen(false)}
                  >
                    From scratch (advanced)
                  </Link>
                </div>
              )}
            </div>
          </div>
          <CreateFromAppModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </div>
      </div>

      {packages.length === 0 ? (
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">
              You haven&apos;t submitted any packages yet.
            </p>
            <Link href="/dashboard/packages/new" className="inline-block mt-4">
              <Button>Submit your first package</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Link
              key={pkg.id}
              href={`/dashboard/packages/${pkg.id}`}
              className="block group"
            >
              <Card className="glass-panel border-0 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden rounded-2xl flex flex-col h-full bg-white">
                {/* Top Illustration Area */}
                <div className="relative h-48 bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
                  
                  {/* Top Right Icon */}
                  <div className="absolute top-4 right-4 w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-md z-20">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  
                  {/* Center Content */}
                  <div className="relative z-10 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm p-4 rounded-full shadow-sm border border-white/60">
                    <DataclausScoreGauge value={pkg.dataclausScore} size="lg" />
                  </div>
                </div>

                {/* Bottom Content Area */}
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2 leading-tight line-clamp-1">
                      {pkg.title}
                    </h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                      Premium {pkg.category.toLowerCase()} dataset. Contains {pkg.claimedMetrics.row_count.toLocaleString()} rows and over {pkg.claimedMetrics.unique_users.toLocaleString()} unique users.
                    </p>
                  </div>
                  
                  <hr className="border-slate-100 my-4" />
                  
                  <div className="flex items-center justify-between mt-auto">
                    <Button variant="outline" size="sm" className="rounded-xl px-4 border-slate-200 hover:bg-slate-50 text-slate-700">
                      View Details
                    </Button>
                    
                    <div className="flex items-center">
                      <Badge
                        variant="secondary"
                        className={`capitalize px-2.5 py-0.5 rounded-md font-medium text-xs ${statusVariant(pkg.status)}`}
                      >
                        {pkg.status === 'certified' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />}
                        {pkg.status === 'evaluating' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse" />}
                        {pkg.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PackagesPage() {
  return (
    <RequireRole role={['developer', 'admin']}>
      <PackagesContent />
    </RequireRole>
  );
}
