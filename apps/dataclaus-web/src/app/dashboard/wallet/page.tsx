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
  getWalletsByOwner,
  getWalletTransactions,
  creditWallet,
} from '@/lib/api';
import type { Wallet, Transaction } from '@/lib/types';
import { formatMoney, REVENUE_SHARES } from '@/lib/types';
import {
  Wallet as WalletIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
} from 'lucide-react';

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchWallets = async () => {
    if (!user) return;
    try {
      const data = await getWalletsByOwner(user.id);
      setWallets(data);
      if (data.length > 0 && !selectedWallet) {
        setSelectedWallet(data[0].id);
      }
    } catch {
      // No wallets
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!selectedWallet) return;
    try {
      const data = await getWalletTransactions(selectedWallet, 20);
      setTransactions(data);
    } catch {
      setTransactions([]);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [user]);

  useEffect(() => {
    if (selectedWallet) {
      fetchTransactions();
    }
  }, [selectedWallet]);

  const handleDeposit = async () => {
    if (!selectedWallet || !depositAmount) return;
    const amount = parseFloat(depositAmount);
    if (amount <= 0) {
      toast({
        title: 'Error',
        description: 'Amount must be positive',
        variant: 'destructive',
      });
      return;
    }
    try {
      await creditWallet(selectedWallet, amount);
      toast({ title: 'Deposit successful' });
      setDepositAmount('');
      fetchWallets();
      fetchTransactions();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Deposit failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalPending = wallets.reduce(
    (sum, w) => sum + (w.pending_balance || 0),
    0
  );
  const currentWallet = wallets.find((w) => w.id === selectedWallet);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Wallet</h1>
        <p className="text-muted-foreground">
          Manage your funds and view transactions
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Available Balance
            </CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totalBalance, 2)}
            </div>
            <p className="text-xs text-muted-foreground">Ready to withdraw</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Balance
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totalPending, 6)}
            </div>
            <p className="text-xs text-muted-foreground">
              Released when ≥{' '}
              {formatMoney(REVENUE_SHARES.MIN_PAYOUT_THRESHOLD, 2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Add Funds</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <Button onClick={handleDeposit} disabled={!selectedWallet}>
              <Plus className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {wallets.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Wallets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {wallets.map((wallet) => (
                <Button
                  key={wallet.id}
                  variant={selectedWallet === wallet.id ? 'default' : 'outline'}
                  onClick={() => setSelectedWallet(wallet.id)}
                >
                  {wallet.type} - {formatMoney(wallet.balance, 2)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How Earnings Work</CardTitle>
          <CardDescription>Understanding micro-payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p>
              Your earnings are calculated as:{' '}
              <strong>Quality Score × Active Usage Time × Revenue Share</strong>
            </p>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">Micro-payment Handling:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>
                  • Amounts below{' '}
                  {formatMoney(REVENUE_SHARES.MIN_PAYOUT_THRESHOLD, 2)} are held
                  as &quot;pending&quot;
                </li>
                <li>
                  • Once pending reaches{' '}
                  {formatMoney(REVENUE_SHARES.MIN_PAYOUT_THRESHOLD, 2)},
                  it&apos;s released to your balance
                </li>
                <li>• This ensures fair distribution even with many users</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Recent transactions for selected wallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No transactions yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const isIncoming = tx.dest_wallet_id === selectedWallet;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="flex items-center gap-2">
                        {isIncoming ? (
                          <ArrowDownLeft className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-red-500" />
                        )}
                        {tx.type}
                      </TableCell>
                      <TableCell
                        className={
                          isIncoming ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {isIncoming ? '+' : '-'}
                        {formatMoney(tx.amount, 6)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.status === 'completed' ? 'success' : 'secondary'
                          }
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(tx.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
