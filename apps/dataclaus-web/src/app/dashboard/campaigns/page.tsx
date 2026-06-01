'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import {
  useCampaignsByBuyer,
  useCreateCampaign,
  useUpdateCampaignStatus,
  useWalletsByOwner,
  useCreditWallet,
  useCreateAdCreative,
  useMyAdCreatives,
} from '@/lib/api-hooks';
import { formatMoney, REVENUE_SHARES } from '@/lib/types';
import {
  Plus,
  Target,
  DollarSign,
  Pause,
  Play,
  Wallet as WalletIcon,
  Image as ImageIcon,
  CheckCircle,
  Clock,
} from 'lucide-react';

export default function CampaignsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showFundForm, setShowFundForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    budget: '',
    bid_per_impression: '',
    min_quality_score: '',
    app_categories: '',
  });
  const [fundAmount, setFundAmount] = useState('');
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [showCreativeForm, setShowCreativeForm] = useState(false);
  const [creativeForm, setCreativeForm] = useState({
    brandName: '',
    imageUrl: '',
    ctaText: '',
  });

  const campaignsQuery = useCampaignsByBuyer(user?.id);
  const walletsQuery = useWalletsByOwner(user?.id);
  const createCampaignMutation = useCreateCampaign();
  const fundWalletMutation = useCreditWallet();
  const updateStatusMutation = useUpdateCampaignStatus();
  const myCreativesQuery = useMyAdCreatives();
  const createCreativeMutation = useCreateAdCreative();

  const campaigns = campaignsQuery.data ?? [];
  const wallets = walletsQuery.data ?? [];
  const loading = campaignsQuery.isLoading || walletsQuery.isLoading;
  const submittingCampaign = createCampaignMutation.isPending;
  const submittingFund = fundWalletMutation.isPending;

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const budget = parseFloat(form.budget);
    const bid = form.bid_per_impression
      ? parseFloat(form.bid_per_impression)
      : undefined;
    const minQuality = form.min_quality_score
      ? parseFloat(form.min_quality_score)
      : undefined;

    if (budget <= 0) {
      toast({
        title: 'Error',
        description: 'Budget must be positive',
        variant: 'destructive',
      });
      return;
    }

    if (bid !== undefined && (bid <= 0 || bid > budget)) {
      toast({
        title: 'Error',
        description: 'Bid must be positive and not exceed total budget',
        variant: 'destructive',
      });
      return;
    }

    const appCategories = form.app_categories
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    if (submittingCampaign) return;
    try {
      await createCampaignMutation.mutateAsync({
        buyer_id: user.id,
        name: form.name,
        description: form.description || undefined,
        budget,
        bid_per_impression: bid,
        targeting: {
          minQualityScore: minQuality,
          appCategories: appCategories.length ? appCategories : undefined,
        },
      });
      toast({ title: 'Campaign created successfully' });
      setForm({
        name: '',
        description: '',
        budget: '',
        bid_per_impression: '',
        min_quality_score: '',
        app_categories: '',
      });
      setShowForm(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to create campaign';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleFundWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(fundAmount);

    if (amount <= 0) {
      toast({
        title: 'Error',
        description: 'Amount must be positive',
        variant: 'destructive',
      });
      return;
    }

    if (wallets.length === 0) {
      toast({
        title: 'Error',
        description: 'No wallet found',
        variant: 'destructive',
      });
      return;
    }

    if (submittingFund) return;
    try {
      await fundWalletMutation.mutateAsync({ id: wallets[0].id, amount });
      toast({ title: 'Wallet funded successfully' });
      setFundAmount('');
      setShowFundForm(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to fund wallet';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (statusBusy) return;
    setStatusBusy(id);
    try {
      await updateStatusMutation.mutateAsync({ id, status });
      toast({ title: `Campaign ${status}` });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to update status';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setStatusBusy(null);
    }
  };

  const handleSubmitCreative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creativeForm.brandName || !creativeForm.imageUrl) {
      toast({ title: 'Error', description: 'Brand name and image URL are required', variant: 'destructive' });
      return;
    }
    if (createCreativeMutation.isPending) return;
    try {
      await createCreativeMutation.mutateAsync({
        brandName: creativeForm.brandName,
        imageUrl: creativeForm.imageUrl,
        ctaText: creativeForm.ctaText || undefined,
      });
      toast({ title: 'Ad creative submitted', description: 'Your ad will be reviewed and activated by our team.' });
      setCreativeForm({ brandName: '', imageUrl: '', ctaText: '' });
      setShowCreativeForm(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit creative';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalBudget = campaigns.reduce((sum, c) => sum + c.total_budget, 0);
  const totalSpent = campaigns.reduce(
    (sum, c) => sum + (c.total_budget - c.remaining),
    0
  );
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your advertising campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFundForm(!showFundForm)}
          >
            <WalletIcon className="h-4 w-4 mr-2" />
            Fund Wallet
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Wallet Balance
            </CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totalBalance, 2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Campaigns
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totalBudget, 2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totalSpent, 2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {showFundForm && (
        <Card>
          <CardHeader>
            <CardTitle>Fund Your Wallet</CardTitle>
            <CardDescription>Add funds to create campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFundWallet} className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="100.00"
                  required
                />
              </div>
              <Button type="submit" disabled={submittingFund}>
                {submittingFund ? 'Funding…' : 'Fund Wallet'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFundForm(false)}
                disabled={submittingFund}
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Campaign</CardTitle>
            <CardDescription>
              Your budget will be distributed:{' '}
              {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
              {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}% to users (varies by
              developer), {REVENUE_SHARES.PLATFORM_FEE_PERCENT}% platform fee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Summer Promo 2024"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Total Budget ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  placeholder="1000.00"
                  required
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Audience or goal"
                />
              </div>
              <div className="space-y-2">
                <Label>Bid per Impression ($)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.bid_per_impression}
                  onChange={(e) =>
                    setForm({ ...form, bid_per_impression: e.target.value })
                  }
                  placeholder="0.0050"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use default eCPM (no campaign auction).
                </p>
              </div>
              <div className="space-y-2">
                <Label>Min Quality Score (0-1)</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={form.min_quality_score}
                  onChange={(e) =>
                    setForm({ ...form, min_quality_score: e.target.value })
                  }
                  placeholder="0.7"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>App Categories (comma-separated)</Label>
                <Input
                  value={form.app_categories}
                  onChange={(e) =>
                    setForm({ ...form, app_categories: e.target.value })
                  }
                  placeholder="social, fitness, gaming"
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={submittingCampaign}>
                  {submittingCampaign ? 'Creating…' : 'Create Campaign'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  disabled={submittingCampaign}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Ad Creative Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Ad Creatives
            </CardTitle>
            <CardDescription>
              Your submitted ad images — active ones are displayed in the app feed
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => setShowCreativeForm(!showCreativeForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Submit Ad
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Buyer's own creatives list */}
          {myCreativesQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (myCreativesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No ad creatives submitted yet. Submit one below — it will go live after review.
            </p>
          ) : (
            <div className="space-y-2">
              {(myCreativesQuery.data ?? []).map((creative) => (
                <div
                  key={creative.id}
                  className={`flex gap-4 items-center p-3 border rounded-lg ${
                    creative.isActive
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/20'
                      : 'bg-slate-50 dark:bg-slate-900/20'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={creative.imageUrl}
                    alt={creative.brandName}
                    className="w-12 h-12 object-cover rounded border shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{creative.brandName}</p>
                    {creative.ctaText && (
                      <p className="text-xs text-muted-foreground">CTA: {creative.ctaText}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(creative.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={creative.isActive ? 'success' : 'outline'}
                    className="shrink-0 flex items-center gap-1"
                  >
                    {creative.isActive ? (
                      <><CheckCircle className="h-3 w-3" /> Active</>
                    ) : (
                      <><Clock className="h-3 w-3" /> Pending Review</>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Submit form */}
          {showCreativeForm && (
            <form onSubmit={handleSubmitCreative} className="grid gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Brand Name *</Label>
                <Input
                  value={creativeForm.brandName}
                  onChange={(e) => setCreativeForm({ ...creativeForm, brandName: e.target.value })}
                  placeholder="e.g., Nike, Apple, Your Brand"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Image URL *</Label>
                <Input
                  value={creativeForm.imageUrl}
                  onChange={(e) => setCreativeForm({ ...creativeForm, imageUrl: e.target.value })}
                  placeholder="https://example.com/your-ad-image.jpg"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: full-screen vertical image (9:16 ratio, min 1080×1920px)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Call-to-Action Text (optional)</Label>
                <Input
                  value={creativeForm.ctaText}
                  onChange={(e) => setCreativeForm({ ...creativeForm, ctaText: e.target.value })}
                  placeholder="e.g., Shop Now, Learn More"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createCreativeMutation.isPending}>
                  {createCreativeMutation.isPending ? 'Submitting…' : 'Submit for Review'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreativeForm(false)}
                  disabled={createCreativeMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading...</p>
          ) : campaigns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No campaigns yet. Create one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Spent</TableHead>
                  <TableHead>Bid</TableHead>
                  <TableHead>Impressions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">
                      {campaign.name}
                    </TableCell>
                    <TableCell>
                      {formatMoney(campaign.total_budget, 2)}
                    </TableCell>
                    <TableCell>{formatMoney(campaign.remaining, 2)}</TableCell>
                    <TableCell>
                      {formatMoney(
                        campaign.total_budget - campaign.remaining,
                        2
                      )}
                    </TableCell>
                    <TableCell>
                      {campaign.bid_per_impression
                        ? formatMoney(campaign.bid_per_impression, 4)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {(campaign.impressions_served ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          campaign.status === 'active'
                            ? 'success'
                            : campaign.status === 'completed'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {campaign.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={statusBusy === campaign.id}
                          onClick={() =>
                            handleStatusChange(campaign.id, 'paused')
                          }
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          {statusBusy === campaign.id ? '…' : 'Pause'}
                        </Button>
                      )}
                      {campaign.status === 'paused' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={statusBusy === campaign.id}
                          onClick={() =>
                            handleStatusChange(campaign.id, 'active')
                          }
                        >
                          <Play className="h-4 w-4 mr-1" />
                          {statusBusy === campaign.id ? '…' : 'Resume'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
