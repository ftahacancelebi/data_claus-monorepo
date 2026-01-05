'use client';

import { useState, useEffect } from 'react';

interface LedgerTransaction {
  id: string;
  source_wallet_id: string;
  dest_wallet_id: string;
  amount: number;
  currency: string;
  reference_id?: string;
  type: string;
  status: string;
  created_at: string;
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const token = localStorage.getItem('dataclaus_token');
      const response = await fetch('/api/ledger', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setTransactions([]);
        return;
      }

      const data = await response.json();
      setTransactions(data.data || data || []);
    } catch (err) {
      setError('Failed to load transactions');
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(tx => tx.type === filter);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ad_revenue': return 'bg-emerald-500/20 text-emerald-400';
      case 'payout': return 'bg-blue-500/20 text-blue-400';
      case 'fee': return 'bg-yellow-500/20 text-yellow-400';
      case 'deposit': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/20 text-emerald-400';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const shortenId = (id: string) => {
    if (!id || id === '00000000-0000-0000-0000-000000000000') return 'Platform';
    return `${id.slice(0, 8)}...`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-slate-400">All ledger entries and financial transactions</p>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {['all', 'ad_revenue', 'payout', 'fee'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === type
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {type === 'all' ? 'All' : type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">ID</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">From</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">To</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Amount</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Type</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-slate-300 font-mono text-sm">
                        {shortenId(tx.id)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-400 font-mono text-sm">
                        {shortenId(tx.source_wallet_id)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-400 font-mono text-sm">
                        {shortenId(tx.dest_wallet_id)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-emerald-400 font-medium">
                        ${tx.amount?.toFixed(6)} {tx.currency}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${getTypeColor(tx.type)}`}>
                        {tx.type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Showing {filteredTransactions.length} of {transactions.length} transactions</span>
        <span className="text-emerald-400 font-medium">
          Total: ${filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0).toFixed(4)}
        </span>
      </div>
    </div>
  );
}
