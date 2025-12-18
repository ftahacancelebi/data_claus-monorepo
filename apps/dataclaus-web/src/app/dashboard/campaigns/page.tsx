'use client';

import { useEffect, useState } from 'react';
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
  createCampaign,
  getCampaignsByBuyer,
  updateCampaignStatus,
  getWalletsByOwner,
  creditWallet,
} from '@/lib/api';
import type { Campaign, Wallet } from '@/lib/types';
import { formatMoney, REVENUE_SHARES } from '@/lib/types';
import {
  Plus,
  Target,
  DollarSign,
  Pause,
  Play,
  Wallet as WalletIcon,
} from 'lucide-react';

export default function CampaignsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showFundForm, setShowFundForm] = useState(false);
  const [form, setForm] = useState({ name: '', budget: '' });
  const [fundAmount, setFundAmount] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [campaignsData, walletsData] = await Promise.all([
        getCampaignsByBuyer(user.id).catch(() => []),
        getWalletsByOwner(user.id).catch(() => []),
      ]);
      setCampaigns(campaignsData);
      setWallets(walletsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const budget = parseFloat(form.budget);

    if (budget <= 0) {
      toast({
        title: 'Error',
        description: 'Budget must be positive',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createCampaign({
        buyer_id: user.id,
        name: form.name,
        budget,
      });
      toast({ title: 'Campaign created successfully' });
      setForm({ name: '', budget: '' });
      setShowForm(false);
      fetchData();
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

    try {
      await creditWallet(wallets[0].id, amount);
      toast({ title: 'Wallet funded successfully' });
      setFundAmount('');
      setShowFundForm(false);
      fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to fund wallet';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateCampaignStatus(id, status);
      toast({ title: `Campaign ${status}` });
      fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to update status';
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
              <Button type="submit">Fund Wallet</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFundForm(false)}
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
                <Label>Budget ($)</Label>
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
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit">Create Campaign</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
                          onClick={() =>
                            handleStatusChange(campaign.id, 'paused')
                          }
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          Pause
                        </Button>
                      )}
                      {campaign.status === 'paused' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleStatusChange(campaign.id, 'active')
                          }
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Resume
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
