'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import type { AuthUser, UserRole } from './types';
import { createUser, registerDeveloper, createWallet } from './api';

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ) => Promise<void>;
  loginAsDemo: (role: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
}

// Demo accounts with proper UUIDs
export const DEMO_ACCOUNTS: Record<UserRole, AuthUser> = {
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'demo.user@dataclaus.io',
    name: 'Demo User',
    role: 'user',
  },
  developer: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'demo.developer@dataclaus.io',
    name: 'Demo Developer',
    role: 'developer',
  },
  buyer: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'demo.buyer@dataclaus.io',
    name: 'Demo Buyer',
    role: 'buyer',
  },
  admin: {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'demo.admin@dataclaus.io',
    name: 'Demo Admin',
    role: 'admin',
  },
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('dataclaus_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('dataclaus_user');
      }
    }
    setIsLoading(false);
  }, []);

  const register = async (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ) => {
    let userId: string;

    try {
      if (role === 'developer') {
        // Register as developer
        const dev = await registerDeveloper({ name, email, password });
        userId = dev.id;
        // Create developer wallet
        await createWallet({
          owner_id: userId,
          type: 'developer',
          currency: 'USD',
        }).catch(() => {});
      } else {
        // Register as user (also used for buyers)
        const newUser = await createUser({ name, email, password });
        userId = newUser.id;
        // Create appropriate wallet type
        const walletType = role === 'buyer' ? 'buyer' : 'user';
        await createWallet({
          owner_id: userId,
          type: walletType,
          currency: 'USD',
        }).catch(() => {});
      }

      const authUser: AuthUser = { id: userId, email, name, role };
      setUser(authUser);
      localStorage.setItem('dataclaus_user', JSON.stringify(authUser));
    } catch (error) {
      throw error;
    }
  };

  const login = async (email: string, password: string, role: UserRole) => {
    // For demo purposes, we'll create a user if they don't exist
    // In production, this would be a proper login endpoint
    try {
      await register(email.split('@')[0] || 'User', email, password, role);
    } catch {
      // If registration fails (user exists), just set the user locally
      // In production, you'd have a proper login endpoint
      const authUser: AuthUser = {
        id: `${role}-${Date.now()}`,
        email,
        name: email.split('@')[0] || 'User',
        role,
      };
      setUser(authUser);
      localStorage.setItem('dataclaus_user', JSON.stringify(authUser));
    }
  };

  // Quick login with demo accounts
  const loginAsDemo = (role: UserRole) => {
    const demoUser = DEMO_ACCOUNTS[role];
    setUser(demoUser);
    localStorage.setItem('dataclaus_user', JSON.stringify(demoUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('dataclaus_user');
  };

  return (
    <AuthContext.Provider
      value={{ user, login, register, loginAsDemo, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
