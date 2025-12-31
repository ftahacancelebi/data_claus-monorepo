/**
 * Auth Hook
 * 
 * Manages authentication state
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { api, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, otp: string) => Promise<{ isNewUser: boolean }>;
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
        const storedUser = await api.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        } else {
          const freshUser = await api.getMe();
          setUser(freshUser);
        }
      }
    } catch (error) {
      console.log('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (phone: string, otp: string) => {
    const result = await api.verifyOtp(phone, otp);
    setUser(result.user);
    return { isNewUser: result.isNewUser };
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
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
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
