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
    if (role === 'developer') {
      // Register as developer
      await registerDeveloper({ name, email, password });
      
      // Auto-login to get the real token
      await login(email, password);
      return;
    } else if (role === 'user') {
      // Register as end-user via /users/register
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          displayName: name 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      // Auto-login after registration
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        throw new Error('Login after registration failed');
      }

      const loginData = await loginResponse.json();
      const userData = loginData.data || loginData;

      const authUser: AuthUser = {
        id: userData.user?.id || userData.id,
        email: userData.user?.email || email,
        name: userData.user?.displayName || name,
        role: 'user',
      };

      setUser(authUser);
      localStorage.setItem('dataclaus_user', JSON.stringify(authUser));
      localStorage.setItem('dataclaus_token', userData.accessToken);
      return;
    } else {
      // Register as buyer or other role
      const newUser = await createUser({ name, email, password });

      // Auto-login to get the real token
      await login(email, password);

      // Create buyer wallet
      await createWallet({
        owner_id: newUser.id,
        type: 'buyer',
        currency: 'USD',
      }).catch(() => {
        // Wallet creation might have been done by backend
      });
    }
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
