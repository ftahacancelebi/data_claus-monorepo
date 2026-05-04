/**
 * useDataClausRealtime
 *
 * Connects to the DataClaus NestJS WebSocket gateway at /realtime.
 * Pushes live `event:scored`, `wallet:credited` and `payout:completed`
 * events to subscribers. Reads the JWT token from SecureStore.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';

const TOKEN_KEY = 'auth_token';
const DATACLAUS_API_PORT = 3000;

function getDataClausWsUrl(): string {
  if (Platform.OS === 'web') return `http://localhost:${DATACLAUS_API_PORT}`;

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:${DATACLAUS_API_PORT}`;
  }

  return Platform.OS === 'android'
    ? `http://10.0.2.2:${DATACLAUS_API_PORT}`
    : `http://localhost:${DATACLAUS_API_PORT}`;
}

export interface ScoreCalculatedEvent {
  eventId: string;
  applicationId: string;
  developerId: string;
  userId: string;
  qualityScore: number;
  payoutAmount: number;
  eventType: string;
  scoredAt: string | null;
}

export interface WalletCreditedEvent {
  impressionId?: string;
  applicationId?: string;
  userId: string;
  developerId?: string;
  userShare?: number;
  devShare?: number;
  platformFee?: number;
  grossRevenue?: number;
  adType?: string;
}

export interface PayoutCompletedEvent {
  payoutRequestId: string;
  userId: string;
  amount: number;
  method: string;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected';

export function useDataClausRealtime() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionState>('idle');

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      let token: string | null = null;
      try {
        token = await SecureStore.getItemAsync(TOKEN_KEY);
      } catch {
        token = null;
      }
      if (!token || cancelled) {
        setStatus('disconnected');
        return;
      }

      setStatus('connecting');
      socket = io(`${getDataClausWsUrl()}/realtime`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => setStatus('connected'));
      socket.on('disconnect', () => setStatus('disconnected'));
      socket.on('connect_error', (err: Error) => {
        console.warn('[DataClausRealtime] connect_error', err.message);
        setStatus('disconnected');
      });

      socketRef.current = socket;
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
      setStatus('idle');
    };
  }, []);

  const on = useCallback(
    <T = unknown>(event: string, handler: (payload: T) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => undefined;
      socket.on(event, handler as (...args: unknown[]) => void);
      return () => {
        socket.off(event, handler as (...args: unknown[]) => void);
      };
    },
    [],
  );

  return { status, on };
}
