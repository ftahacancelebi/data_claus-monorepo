'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { 
    Users,
    MagnifyingGlass,
    Code,
    User,
    ShoppingCart,
    Eye,
    PencilSimple,
    Trash,
    CheckCircle,
    Clock,
    Warning,
    Export,
    Plus
} from 'phosphor-react';

// Mock users data
const mockUsers = [
  { id: '1', name: 'John Smith', email: 'john@developer.io', role: 'developer', status: 'active', created: '2024-11-15', apps: 5, revenue: 1250.50 },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@enterprise.com', role: 'buyer', status: 'active', created: '2024-11-20', campaigns: 3, spend: 4500 },
  { id: '3', name: 'Mike Williams', email: 'mike@email.com', role: 'user', status: 'active', created: '2024-12-01', earnings: 45.25 },
  { id: '4', name: 'Emma Davis', email: 'emma@startup.io', role: 'developer', status: 'pending', created: '2024-12-10', apps: 1, revenue: 0 },
  { id: '5', name: 'Alex Chen', email: 'alex@bigcorp.com', role: 'buyer', status: 'active', created: '2024-12-05', campaigns: 8, spend: 12500 },
  { id: '6', name: 'Lisa Anderson', email: 'lisa@mail.com', role: 'user', status: 'active', created: '2024-12-12', earnings: 28.75 },
  { id: '7', name: 'David Brown', email: 'david@dev.co', role: 'developer', status: 'suspended', created: '2024-10-20', apps: 2, revenue: 340 },
  { id: '8', name: 'Jennifer Wilson', email: 'jen@agency.com', role: 'buyer', status: 'active', created: '2024-11-28', campaigns: 2, spend: 2200 },
  { id: '9', name: 'Robert Taylor', email: 'robert@email.com', role: 'user', status: 'active', created: '2024-12-15', earnings: 12.00 },
  { id: '10', name: 'Amanda Martinez', email: 'amanda@tech.io', role: 'developer', status: 'active', created: '2024-12-08', apps: 3, revenue: 890 },
];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'developer' | 'buyer' | 'user'>('all');

  if (!user || user.role !== 'admin') return null;

  const filteredUsers = mockUsers.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'developer': return <Code size={14} className="text-emerald-600" />;
      case 'buyer': return <ShoppingCart size={14} className="text-purple-600" />;
      case 'user': return <User size={14} className="text-blue-600" />;
      default: return null;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'developer': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">{getRoleIcon(role)} Developer</Badge>;
      case 'buyer': return <Badge className="bg-purple-50 text-purple-700 border-purple-200 gap-1">{getRoleIcon(role)} Buyer</Badge>;
      case 'user': return <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1">{getRoleIcon(role)} End User</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700"><CheckCircle size={12} weight="fill" /> Active</span>;
      case 'pending': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700"><Clock size={12} weight="fill" /> Pending</span>;
      case 'suspended': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700"><Warning size={12} weight="fill" /> Suspended</span>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    total: mockUsers.length,
    developers: mockUsers.filter(u => u.role === 'developer').length,
    buyers: mockUsers.filter(u => u.role === 'buyer').length,
    users: mockUsers.filter(u => u.role === 'user').length,
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">User Management</h1>
            <p className="text-slate-500 mt-1">
              View and manage all platform users.
            </p>
         </div>
         <div className="flex gap-3">
            <Button variant="outline" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
               <Export size={18} className="mr-2" />
               Export
            </Button>
            <Button className="bg-primary hover:bg-blue-800 text-white">
               <Plus size={18} className="mr-2" weight="bold" />
               Add User
            </Button>
         </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Users</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
            </div>
            <Users size={24} className="text-primary" weight="duotone" />
          </CardContent>
        </Card>
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Developers</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.developers}</p>
            </div>
            <Code size={24} className="text-emerald-500" weight="duotone" />
          </CardContent>
        </Card>
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Buyers</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.buyers}</p>
            </div>
            <ShoppingCart size={24} className="text-purple-500" weight="duotone" />
          </CardContent>
        </Card>
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">End Users</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.users}</p>
            </div>
            <User size={24} className="text-blue-500" weight="duotone" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-panel border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <Input 
                placeholder="Search by name or email..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'developer', 'buyer', 'user'] as const).map((role) => (
                <Button 
                  key={role}
                  variant={roleFilter === role ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRoleFilter(role)}
                  className={roleFilter === role ? 'bg-primary text-white' : 'bg-white'}
                >
                  {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1) + 's'}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="glass-panel border-0 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-semibold text-slate-500">User</TableHead>
                <TableHead className="font-semibold text-slate-500">Role</TableHead>
                <TableHead className="font-semibold text-slate-500">Status</TableHead>
                <TableHead className="font-semibold text-slate-500">Joined</TableHead>
                <TableHead className="font-semibold text-slate-500">Metrics</TableHead>
                <TableHead className="font-semibold text-slate-500 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-semibold text-sm">
                        {u.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(u.role)}</TableCell>
                  <TableCell>{getStatusBadge(u.status)}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {new Date(u.created).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-600">
                      {u.role === 'developer' && <span>{u.apps} apps • ${u.revenue?.toFixed(2)}</span>}
                      {u.role === 'buyer' && <span>{u.campaigns} campaigns • ${u.spend?.toLocaleString()}</span>}
                      {u.role === 'user' && <span>Earned ${u.earnings?.toFixed(2)}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-primary">
                        <Eye size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600">
                        <PencilSimple size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600">
                        <Trash size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
