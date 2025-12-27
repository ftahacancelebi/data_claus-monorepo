'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import type { AuthUser, UserRole } from './types';
import { createUser, registerDeveloper, createWallet, loginUser } from './api';

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('dataclaus_user');
    const token = localStorage.getItem('dataclaus_token');

    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('dataclaus_user');
        localStorage.removeItem('dataclaus_token');
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
    let userName: string;
    let userEmail: string;

    if (role === 'developer') {
      // Register as developer
      const dev = await registerDeveloper({ name, email, password });
      userId = dev.id;
      userName = dev.name;
      userEmail = dev.email;

      // Create developer wallet
      await createWallet({
        owner_id: userId,
        type: 'developer',
        currency: 'USD',
      }).catch(() => {
        // Wallet creation is optional
      });
    } else {
      // Register as user (also used for buyers and admins)
      const newUser = await createUser({ name, email, password });
      userId = newUser.id;
      userName = newUser.name;
      userEmail = newUser.email;

      // Create appropriate wallet type
      const walletType = role === 'buyer' ? 'buyer' : 'user';
      await createWallet({
        owner_id: userId,
        type: walletType,
        currency: 'USD',
      }).catch(() => {
        // Wallet creation is optional
      });
    }

    const authUser: AuthUser = {
      id: userId,
      email: userEmail,
      name: userName,
      role,
    };

    setUser(authUser);
    localStorage.setItem('dataclaus_user', JSON.stringify(authUser));
    // In a real app, you'd get a JWT token from the backend
    localStorage.setItem('dataclaus_token', `token-${userId}`);
  };

  const login = async (email: string, password: string) => {
    // Call the backend login endpoint
    const response = await loginUser(email, password);

    const authUser: AuthUser = {
      id: response.id,
      email: response.email,
      name: response.name,
      role: response.role as UserRole,
    };

    setUser(authUser);
    localStorage.setItem('dataclaus_user', JSON.stringify(authUser));
    localStorage.setItem('dataclaus_token', response.token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('dataclaus_user');
    localStorage.removeItem('dataclaus_token');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
