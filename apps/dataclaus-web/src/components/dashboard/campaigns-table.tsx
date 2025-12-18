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
import { Button } from '@/components/ui/button';
import { updateCampaignStatus } from '@/lib/api';

interface Campaign {
  id: string;
  buyer_id: string;
  name: string;
  total_budget: number;
  remaining: number;
  status: string;
  created_at: string;
}

interface CampaignsTableProps {
  campaigns: Campaign[];
  onRefresh: () => void;
}

export function CampaignsTable({ campaigns, onRefresh }: CampaignsTableProps) {
  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateCampaignStatus(id, status);
      onRefresh();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Budget</TableHead>
          <TableHead>Remaining</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center text-muted-foreground"
            >
              No campaigns found
            </TableCell>
          </TableRow>
        ) : (
          campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell className="font-medium">{campaign.name}</TableCell>
              <TableCell>${campaign.total_budget.toLocaleString()}</TableCell>
              <TableCell>${campaign.remaining.toLocaleString()}</TableCell>
              <TableCell>{getStatusBadge(campaign.status)}</TableCell>
              <TableCell>
                {campaign.status === 'active' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(campaign.id, 'paused')}
                  >
                    Pause
                  </Button>
                )}
                {campaign.status === 'paused' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(campaign.id, 'active')}
                  >
                    Resume
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
