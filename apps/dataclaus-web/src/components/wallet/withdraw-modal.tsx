'use client';

import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CircleNotch, Bank, CurrencyBtc } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useRequestPayout } from '@/lib/api-hooks';
import type { PayoutMethod, PayoutRecord } from '@/lib/api';

interface WithdrawModalProps {
  open: boolean;
  onClose: () => void;
  availableBalance: number;
  currency: string;
  onSuccess?: (payout: PayoutRecord) => void;
}

const MIN_PAYOUT = 0.01;

export function WithdrawModal({
  open,
  onClose,
  availableBalance,
  currency,
  onSuccess,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<PayoutMethod>('bank_simulation');
  const [destination, setDestination] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [completedPayout, setCompletedPayout] = useState<PayoutRecord | null>(
    null,
  );

  const payoutMutation = useRequestPayout();
  const submitting = payoutMutation.isPending;

  const parsedAmount = Number(amount);
  const isAmountValid =
    !Number.isNaN(parsedAmount) &&
    parsedAmount >= MIN_PAYOUT &&
    parsedAmount <= availableBalance;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAmountValid) {
      setError(
        parsedAmount > availableBalance
          ? 'Amount exceeds your available balance.'
          : `Amount must be at least $${MIN_PAYOUT}.`,
      );
      return;
    }

    setError(null);
    try {
      const payout = await payoutMutation.mutateAsync({
        amount: parsedAmount,
        method,
        destination: destination.trim() || undefined,
      });
      setCompletedPayout(payout);
      onSuccess?.(payout);
      // Cache invalidation already handled by useRequestPayout.onSuccess —
      // no manual refetch needed here or in the parent page.
    } catch (err) {
      setError((err as Error).message ?? 'Withdraw request failed');
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setAmount('');
    setDestination('');
    setMethod('bank_simulation');
    setError(null);
    setCompletedPayout(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {completedPayout ? 'Withdrawal Submitted' : 'Withdraw Funds'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {completedPayout
                    ? 'Tracking the payout request'
                    : `Available: $${availableBalance.toFixed(4)} ${currency}`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={handleClose}
                className="rounded-full h-8 w-8 inline-flex items-center justify-center hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            {completedPayout ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-700 border-amber-200"
                  >
                    {completedPayout.status}
                  </Badge>
                  <p className="text-sm text-slate-500">
                    ID: {completedPayout.id.slice(0, 8)}…
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 p-4 bg-slate-50">
                  <div className="text-xs text-slate-500">Amount</div>
                  <div className="text-2xl font-bold text-slate-900">
                    ${Number(completedPayout.amount).toFixed(4)}{' '}
                    {completedPayout.currency}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Method:{' '}
                    {completedPayout.method === 'bank_simulation'
                      ? 'Bank (simulated)'
                      : 'Crypto (simulated)'}
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your funds are held in the platform treasury until an admin
                  approves the request. The double-entry ledger remains
                  balanced throughout — view{' '}
                  <span className="font-mono">/admin/ledger/invariant</span> for
                  proof.
                </p>
                <Button onClick={handleClose} className="w-full" size="lg">
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="withdraw-amount">Amount (USD)</Label>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    min={MIN_PAYOUT}
                    max={availableBalance}
                    placeholder={`Min ${MIN_PAYOUT}, max ${availableBalance.toFixed(4)}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Method</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMethod('bank_simulation')}
                      disabled={submitting}
                      className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm transition ${
                        method === 'bank_simulation'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <Bank size={18} weight="duotone" />
                      <span className="font-medium">Bank</span>
                      <span className="text-xs opacity-70">simulated</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod('crypto_simulation')}
                      disabled={submitting}
                      className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm transition ${
                        method === 'crypto_simulation'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <CurrencyBtc size={18} weight="duotone" />
                      <span className="font-medium">Crypto</span>
                      <span className="text-xs opacity-70">simulated</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="withdraw-destination">
                    Destination (optional)
                  </Label>
                  <Input
                    id="withdraw-destination"
                    type="text"
                    placeholder={
                      method === 'bank_simulation'
                        ? 'IBAN / Account number'
                        : 'Wallet address'
                    }
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                {error && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Funds are held in the platform treasury until an admin
                  approves the request. Stripe is in simulation mode — no real
                  money moves during demo.
                </p>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting || !isAmountValid}
                >
                  {submitting ? (
                    <>
                      <CircleNotch size={16} className="animate-spin mr-2" />
                      Submitting…
                    </>
                  ) : (
                    `Withdraw $${parsedAmount > 0 ? parsedAmount.toFixed(2) : '0.00'}`
                  )}
                </Button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
