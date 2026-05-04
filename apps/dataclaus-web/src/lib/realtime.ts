'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';

const TOKEN_KEYS = [
  'dataclaus_token',
  'dataclaus_user_access_token',
] as const;

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  for (const key of TOKEN_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return null;
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

/**
 * useRealtime — Socket.IO client wrapper for the DataClaus backend.
 *
 * - Reads the JWT token from localStorage (supports both user + developer keys).
 * - Connects to /realtime namespace with auto-reconnect (5 attempts).
 * - Returns: socket reference, connection state, on/off helper,
 *   and `subscribeToApplication(appId)`.
 *
 * Usage:
 *   const { on, status } = useRealtime();
 *   useEffect(() => on<ScoreCalculatedEvent>('event:scored', (p) => ...), [on]);
 */
export function useRealtime() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionState>('idle');

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    const socket = io(`${WS_URL}/realtime`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', (err) => {
      console.warn('[realtime] connect_error', err.message);
      setStatus('disconnected');
    });

    socketRef.current = socket;

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
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

  const subscribeToApplication = useCallback((applicationId: string) => {
    const socket = socketRef.current;
    if (!socket) return Promise.resolve({ ok: false, reason: 'not_ready' });
    return new Promise<{ ok: boolean; room?: string; reason?: string }>(
      (resolve) => {
        socket.emit(
          'subscribe:application',
          { applicationId },
          (ack: { ok: boolean; room?: string; reason?: string }) => {
            resolve(ack);
          },
        );
      },
    );
  }, []);

  return { status, on, subscribeToApplication };
}
