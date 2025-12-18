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
import { generateApiKey, listApiKeys, revokeApiKey } from '@/lib/api';
import type { ApiKey } from '@/lib/types';
import { Key, Plus, Copy, Trash2, AlertTriangle } from 'lucide-react';

export default function ApiKeysPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newRawKey, setNewRawKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchKeys = async () => {
    if (!user) return;
    try {
      const keys = await listApiKeys(user.id);
      setApiKeys(keys);
    } catch {
      // No keys yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [user]);

  if (!user) return null;

  const handleGenerate = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a key name',
        variant: 'destructive',
      });
      return;
    }
    setGenerating(true);
    try {
      const result = await generateApiKey(user.id, newKeyName);
      setNewRawKey(result.raw_key);
      setNewKeyName('');
      fetchKeys();
      toast({
        title: 'API Key generated',
        description: "Save the key - it won't be shown again!",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate key';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await revokeApiKey(user.id, keyId);
      fetchKeys();
      toast({ title: 'API Key revoked' });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to revoke key';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const activeKeys = apiKeys.filter((k) => k.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">
          Manage your API keys for data ingestion
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Generate New Key
            </CardTitle>
            <CardDescription>
              Create a new API key for your applications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Key Name</Label>
              <Input
                placeholder="e.g., Production Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              <Plus className="h-4 w-4 mr-2" />
              {generating ? 'Generating...' : 'Generate Key'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span>Total Keys</span>
              <span className="font-bold">{apiKeys.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span>Active Keys</span>
              <span className="font-bold text-green-600">{activeKeys}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span>Revoked Keys</span>
              <span className="font-bold text-red-600">
                {apiKeys.length - activeKeys}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {newRawKey && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              New API Key Created
            </CardTitle>
            <CardDescription>
              Copy this key now. You won&apos;t be able to see it again!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={newRawKey} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(newRawKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setNewRawKey('')}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>Manage existing API keys</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No API keys yet. Generate one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono">
                      {key.key_prefix}...
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={key.is_active ? 'success' : 'destructive'}
                      >
                        {key.is_active ? 'Active' : 'Revoked'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {key.is_active && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRevoke(key.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Revoke
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

      <Card>
        <CardHeader>
          <CardTitle>API Usage</CardTitle>
          <CardDescription>
            How to use your API key for data ingestion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Required Headers:</p>
            <code className="text-xs block">X-API-Key: your-api-key</code>
            <code className="text-xs block">
              X-Signature: hmac-sha256-signature
            </code>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Endpoint:</p>
            <code className="text-xs">POST /v1/ingest</code>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Signature Calculation:</p>
            <ol className="text-xs space-y-1 list-decimal list-inside">
              <li>Take the raw JSON request body</li>
              <li>Compute HMAC-SHA256 using your API key as the secret</li>
              <li>Hex-encode the result</li>
              <li>Set as X-Signature header</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
