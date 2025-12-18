'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Transaction {
  id: string;
  source_wallet_id: string;
  dest_wallet_id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  created_at: string;
}

interface TransactionsTableProps {
  transactions: Transaction[];
}

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'payout':
        return <Badge variant="success">Payout</Badge>;
      case 'deposit':
        return <Badge variant="default">Deposit</Badge>;
      case 'fee':
        return <Badge variant="secondary">Fee</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center text-muted-foreground"
            >
              No transactions found
            </TableCell>
          </TableRow>
        ) : (
          transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-mono text-xs">
                {tx.id.slice(0, 8)}...
              </TableCell>
              <TableCell>{getTypeBadge(tx.type)}</TableCell>
              <TableCell>
                ${tx.amount.toFixed(2)} {tx.currency}
              </TableCell>
              <TableCell>
                <Badge
                  variant={tx.status === 'completed' ? 'success' : 'secondary'}
                >
                  {tx.status}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(tx.created_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
