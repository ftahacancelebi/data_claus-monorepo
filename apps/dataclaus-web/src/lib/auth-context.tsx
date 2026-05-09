'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import type { AuthUser, UserRole } from './types';
import {
  createUser,
  registerDeveloper,
  createWallet,
  loginUser,
  apiLogout,
} from './api';

/**
 * Auth lifecycle states.
 * - 'unknown': we haven't checked localStorage yet (first paint after hydration).
 *   Treat as "neither authed nor guest" — render a skeleton, do not redirect.
 * - 'authed': we have a user.
 * - 'guest': we hydrated and there is no user.
 *
 * Why this matters: code that treats 'unknown' as 'guest' kicks logged-in users
 * back to /login on every hard refresh.
 */
export type AuthStatus = 'unknown' | 'authed' | 'guest';

interface AuthContextType {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ) => Promise<void>;
  logout: () => void;
  /** @deprecated use `status === 'unknown'` instead. Kept for backwards compatibility. */
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('unknown');

  useEffect(() => {
    const stored = localStorage.getItem('dataclaus_user');
    const token = localStorage.getItem('dataclaus_token');

    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
        setStatus('authed');
      } catch {
        localStorage.removeItem('dataclaus_user');
        localStorage.removeItem('dataclaus_token');
        setStatus('guest');
      }
    } else {
      setStatus('guest');
    }
  }, []);

  const logout = useCallback(() => {
    // Local cleanup runs immediately so the UI flips to 'guest' even if the
    // backend round-trip is slow or fails.
    setUser(null);
    setStatus('guest');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dataclaus_user');
      localStorage.removeItem('dataclaus_token');
      localStorage.removeItem('dataclaus_user_access_token');
    }
    // Best-effort cookie clear on the backend. Errors are swallowed inside
    // apiLogout so a cookie left behind doesn't block the logout UX.
    void apiLogout();
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
      setStatus('authed');
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

  const login = async (email: string, password: string): Promise<AuthUser> => {
    // Call the backend login endpoint
    const response = await loginUser(email, password);

    const authUser: AuthUser = {
      id: response.id,
      email: response.email,
      name: response.name,
      role: response.role as UserRole,
    };

    setUser(authUser);
    setStatus('authed');
    localStorage.setItem('dataclaus_user', JSON.stringify(authUser));
    localStorage.setItem('dataclaus_token', response.token);
    return authUser;
  };

  const isLoading = status === 'unknown';

  return (
    <AuthContext.Provider
      value={{ user, status, login, register, logout, isLoading }}
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
