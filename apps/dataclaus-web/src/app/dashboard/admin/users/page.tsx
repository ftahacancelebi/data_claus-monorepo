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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { Search, Users, Code, ShoppingBag, Shield } from 'lucide-react';

// Mock users data
const MOCK_USERS = [
  {
    id: 'user-001',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    status: 'active',
    created: '2024-01-15',
  },
  {
    id: 'user-002',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'user',
    status: 'active',
    created: '2024-02-20',
  },
  {
    id: 'dev-001',
    name: 'Dev Corp',
    email: 'dev@corp.com',
    role: 'developer',
    status: 'active',
    created: '2024-01-10',
  },
  {
    id: 'dev-002',
    name: 'Tech Inc',
    email: 'tech@inc.com',
    role: 'developer',
    status: 'active',
    created: '2024-03-05',
  },
  {
    id: 'buyer-001',
    name: 'Ad Agency',
    email: 'ads@agency.com',
    role: 'buyer',
    status: 'active',
    created: '2024-02-01',
  },
  {
    id: 'buyer-002',
    name: 'Marketing Co',
    email: 'marketing@co.com',
    role: 'buyer',
    status: 'suspended',
    created: '2024-01-25',
  },
  {
    id: 'admin-001',
    name: 'Admin User',
    email: 'admin@dataclaus.com',
    role: 'admin',
    status: 'active',
    created: '2024-01-01',
  },
];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  if (!user || user.role !== 'admin') {
    return <div className="p-4">Access denied</div>;
  }

  const filteredUsers = MOCK_USERS.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const userCounts = {
    user: MOCK_USERS.filter((u) => u.role === 'user').length,
    developer: MOCK_USERS.filter((u) => u.role === 'developer').length,
    buyer: MOCK_USERS.filter((u) => u.role === 'buyer').length,
    admin: MOCK_USERS.filter((u) => u.role === 'admin').length,
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <Users className="h-4 w-4" />;
      case 'developer':
        return <Code className="h-4 w-4" />;
      case 'buyer':
        return <ShoppingBag className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage all platform users</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">End Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCounts.user}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Developers</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCounts.developer}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Buyers</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCounts.buyer}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCounts.admin}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'user', 'developer', 'buyer', 'admin'].map((role) => (
            <Button
              key={role}
              variant={roleFilter === role ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter(role)}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Platform user directory</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1 w-fit"
                    >
                      {getRoleIcon(u.role)}
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        u.status === 'active' ? 'success' : 'destructive'
                      }
                    >
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.created}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
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
