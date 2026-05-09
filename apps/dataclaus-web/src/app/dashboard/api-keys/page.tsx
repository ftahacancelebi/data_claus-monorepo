'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import {
  useApiKeys,
  useGenerateApiKey,
  useRevokeApiKey,
} from '@/lib/api-hooks';
import { 
    Key, 
    Plus, 
    Copy, 
    Trash, 
    Warning, 
    ShieldCheck, 
    Code, 
    CheckCircle,
    LockKey
} from 'phosphor-react';

export default function ApiKeysPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState('');
  const [newRawKey, setNewRawKey] = useState('');

  const apiKeysQuery = useApiKeys(user?.id);
  const apiKeys = apiKeysQuery.data ?? [];
  const loading = apiKeysQuery.isLoading;
  const fetchError = apiKeysQuery.error?.message ?? null;

  const generateMutation = useGenerateApiKey(user?.id);
  const revokeMutation = useRevokeApiKey(user?.id);
  const generating = generateMutation.isPending;

  if (!user) return null;

  const handleGenerate = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a key name to proceed.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const result = await generateMutation.mutateAsync(newKeyName);
      setNewRawKey(result.raw_key);
      setNewKeyName('');
      toast({
        title: 'Success',
        description: 'API Key generated successfully.',
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate key';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm('Revoke this API key? Any apps using it will stop working immediately.')) {
      return;
    }
    try {
      await revokeMutation.mutateAsync(keyId);
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">API Credentials</h1>
            <p className="text-slate-500 mt-1">
              Secure access tokens for communicating with the DataClaus Ingestion API.
            </p>
         </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Generator Card */}
        <Card className="lg:col-span-2 glass-panel border-0 shadow-lg shadow-blue-100/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key size={20} className="text-primary" weight="duotone" />
              Generate New Key
            </CardTitle>
            <CardDescription>
              Create a new API key for your applications. Treat these keys like passwords.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                <Label htmlFor="keyName">Key Name</Label>
                <div className="relative">
                    <ShieldCheck className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <Input
                        id="keyName"
                        placeholder="e.g. Production Mobile App"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="pl-10"
                    />
                </div>
                </div>
                <Button 
                    onClick={handleGenerate} 
                    disabled={generating}
                    className="bg-primary hover:bg-blue-700 text-white min-w-[140px]"
                >
                {generating ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" /> : <Plus weight="bold" className="mr-2" />}
                {generating ? 'Creating...' : 'Create Key'}
                </Button>
            </div>

            <AnimatePresence>
            {newRawKey && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                >
                    <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                    <Warning size={20} className="text-amber-600" weight="duotone" />
                    <AlertTitle className="font-bold ml-2">Save this key immediately</AlertTitle>
                    <AlertDescription className="mt-2 text-amber-800">
                        <p className="text-xs mb-3">This implies read/write access. It will not be shown again.</p>
                        <div className="flex items-center gap-2 bg-white/80 border border-amber-200 p-2 rounded-md">
                        <code className="flex-1 font-mono text-xs break-all text-slate-800 select-all">{newRawKey}</code>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-amber-100 text-amber-700"
                            onClick={() => copyToClipboard(newRawKey)}
                        >
                            <Copy size={16} />
                        </Button>
                        </div>
                        <div className="mt-3 flex justify-end">
                             <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setNewRawKey('')}
                                className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                            >
                                I have saved it
                            </Button>
                        </div>
                    </AlertDescription>
                    </Alert>
                </motion.div>
            )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="glass-panel border-0 shadow-lg shadow-blue-100/30">
          <CardHeader>
            <CardTitle className="text-lg">Security Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-sm font-medium text-slate-500">Total Keys</span>
              <span className="font-bold text-slate-900">{apiKeys.length}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-sm font-medium text-blue-700">Active</span>
              <div className="flex items-center gap-2">
                 <CheckCircle size={16} className="text-blue-500" weight="fill" />
                 <span className="font-bold text-blue-700">{activeKeys}</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-sm font-medium text-slate-500">Revoked</span>
              <span className="font-bold text-slate-400">
                {apiKeys.length - activeKeys}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Keys List */}
      <Card className="glass-panel border-0 shadow-xl shadow-blue-100/30 overflow-hidden">
        <CardHeader className="bg-white/50 border-b border-blue-50/50">
          <CardTitle className="text-lg font-medium text-slate-900">Active Credentials</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
             <div className="p-8 text-center text-slate-400">Loading credentials...</div>
          ) : fetchError ? (
             <div className="p-12 text-center flex flex-col items-center gap-3">
                 <div className="h-12 w-12 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                     <Warning size={24} weight="duotone" />
                 </div>
                 <p className="text-slate-700 font-medium">Couldn&apos;t load API keys</p>
                 <p className="text-sm text-slate-500 max-w-md mx-auto">{fetchError}</p>
                 <Button size="sm" variant="outline" onClick={() => apiKeysQuery.refetch()}>Retry</Button>
             </div>
          ) : apiKeys.length === 0 ? (
             <div className="p-12 text-center flex flex-col items-center gap-3">
                 <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                     <LockKey size={24} weight="duotone" />
                 </div>
                 <p className="text-slate-500 font-medium">No API keys found.</p>
                 <p className="text-sm text-slate-400 max-w-xs mx-auto">Generate your first key to start sending data to the platform.</p>
             </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-500">Key Name</TableHead>
                  <TableHead className="font-semibold text-slate-500">Token Prefix</TableHead>
                  <TableHead className="font-semibold text-slate-500">Status</TableHead>
                  <TableHead className="text-right font-semibold text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium text-slate-900 flex items-center gap-2">
                        <Key size={16} className="text-blue-400" />
                        {key.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 bg-slate-100/50 py-1 rounded w-fit">
                      {key.key_prefix}•••••••••••••••••
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`
                             ${key.is_active 
                                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200' 
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200'}
                             border
                        `}
                      >
                        {key.is_active ? 'Active' : 'Revoked'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {key.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={revokeMutation.isPending}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                          onClick={() => handleRevoke(key.id)}
                        >
                          <Trash size={16} weight="duotone" className="mr-2" />
                          {revokeMutation.isPending ? 'Revoking…' : 'Revoke'}
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

      {/* Integration Guide */}
      <Card className="bg-slate-900 text-slate-300 border-slate-800">
         <CardHeader>
            <div className="flex items-center gap-2 mb-2">
                <Code size={24} className="text-blue-400" />
                <CardTitle className="text-white">Integration Guide</CardTitle>
            </div>
            <CardDescription className="text-slate-400">Use the following headers to authenticate your requests.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4 font-mono text-sm">
            <div className="grid gap-4 md:grid-cols-2">
               <div className="space-y-2">
                   <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Headers</div>
                   <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                       <div className="flex items-center gap-3 mb-2">
                           <span className="text-blue-400">X-API-Key:</span>
                           <span className="text-slate-500">&lt;your_api_key&gt;</span>
                       </div>
                       <div className="flex items-center gap-3">
                           <span className="text-purple-400">X-Signature:</span>
                           <span className="text-slate-500">&lt;hmac_sha256_signature&gt;</span>
                       </div>
                   </div>
               </div>
               <div className="space-y-2">
                   <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Endpoint</div>
                   <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center h-[86px]">
                       <span className="text-blue-400 mr-2">POST</span>
                       <span className="text-white">/v1/ingest</span>
                   </div>
               </div>
            </div>
         </CardContent>
      </Card>
    </div>
  );
}
