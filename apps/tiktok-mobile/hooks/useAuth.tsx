/**
 * Auth Hook
 *
 * Manages authentication state.
 */

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import { api, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { username?: string; avatar?: string; bio?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isLoggedIn = await api.isLoggedIn();
      if (isLoggedIn) {
        try {
          const freshUser = await api.getMe();
          setUser(freshUser);
          console.log('✅ User authenticated:', freshUser.username || freshUser.id);
        } catch (error) {
          console.log('⚠️ Token invalid, logging out');
          await api.logout();
          setUser(null);
        }
      } else {
        console.log('🔒 No stored credentials - user needs to login');
        setUser(null);
      }
    } catch (error) {
      console.log('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
    console.log('✅ Logged in as:', result.user.username || result.user.id);
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const result = await api.register(email, name, password);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    console.log('👋 Logged out');
  }, []);

  const updateProfile = useCallback(async (data: { username?: string; avatar?: string; bio?: string }) => {
    const result = await api.updateProfile(data);
    setUser(result.user);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const freshUser = await api.getMe();
      setUser(freshUser);
    } catch (error) {
      console.log('Failed to refresh user:', error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
