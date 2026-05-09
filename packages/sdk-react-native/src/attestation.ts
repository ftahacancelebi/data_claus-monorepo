/**
 * Platform attestation module.
 *
 * Generates an attestation envelope that the server uses to verify the SDK
 * is running on a real, unmodified app build — not a forked SDK or an
 * emulator with patched native libraries.
 *
 * Production wiring (host app responsibility):
 *   - iOS: Apple App Attest via `react-native-app-attest` or a native module
 *   - Android: Play Integrity via `react-native-google-play-integrity` or
 *     a native module
 *
 * The host app installs ONE of these and registers it with
 * `setAttestationProvider(...)` at boot. The SDK then calls
 * `produceAttestation(challenge)` whenever it needs a fresh envelope.
 *
 * In dev/test mode (or when no provider is registered) the module returns a
 * stub envelope that the server accepts as `attestationVerified: false`.
 * This is intentional — production deployments should:
 *   1. Register a real provider on app boot
 *   2. Reject seal calls with `attestationVerified: false` server-side
 */

import { Platform } from 'react-native';

export type AttestationPlatform = 'ios' | 'android' | 'web';

export interface AttestationProvider {
  platform: AttestationPlatform;
  /**
   * Produce a platform-signed attestation envelope for the given challenge.
   * Implementations should return a base64 / base64url string the server
   * can decode and verify against Apple / Google attestation services.
   */
  produce(challenge: string): Promise<string>;
}

let registeredProvider: AttestationProvider | null = null;

/**
 * Register the host-app provided attestation backend. Call this once at app
 * boot, BEFORE any SDK ad calls.
 */
export function setAttestationProvider(provider: AttestationProvider): void {
  registeredProvider = provider;
}

/**
 * Produce an attestation envelope. Returns null when no provider is
 * registered (dev/test mode).
 */
export async function produceAttestation(
  challenge: string,
): Promise<string | null> {
  if (registeredProvider) {
    try {
      return await registeredProvider.produce(challenge);
    } catch (err) {
      if (__DEV__) {
        console.warn('[DataClaus Attestation] provider failed:', err);
      }
      return null;
    }
  }
  return stubAttestation(challenge);
}

/**
 * Generates a deterministic but clearly-stub envelope for dev mode. The
 * server treats any non-empty attestation as `attestationVerified=false`
 * unless it can verify it against the platform service — so this stub is
 * harmless in production (it will always fail server-side verification).
 */
function stubAttestation(challenge: string): string {
  const platform = (Platform.OS as AttestationPlatform) ?? 'web';
  const envelope = {
    kind: 'dev-stub',
    platform,
    challenge,
    timestamp: Date.now(),
  };
  const json = JSON.stringify(envelope);
  // RN runtimes ship with `btoa` on the global; older bundlers may proxy
  // through Node's Buffer. Both paths are guarded so the SDK keeps building
  // even when @types/node is absent in the host project.
  const g = globalThis as {
    btoa?: (s: string) => string;
    Buffer?: { from: (input: string, encoding: string) => { toString: (e: string) => string } };
  };
  if (typeof g.btoa === 'function') return g.btoa(json);
  if (g.Buffer) return g.Buffer.from(json, 'utf8').toString('base64');
  // Last-resort manual base64 (ASCII only — the JSON above always is).
  return base64Encode(json);
}

function base64Encode(input: string): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < input.length) {
    const a = input.charCodeAt(i++);
    const b = i < input.length ? input.charCodeAt(i++) : NaN;
    const c = i < input.length ? input.charCodeAt(i++) : NaN;
    const e1 = a >> 2;
    const e2 = ((a & 3) << 4) | ((b || 0) >> 4);
    const e3 = isNaN(b) ? 64 : (((b & 15) << 2) | ((c || 0) >> 6));
    const e4 = isNaN(c) ? 64 : (c & 63);
    result +=
      chars.charAt(e1) +
      chars.charAt(e2) +
      (e3 === 64 ? '=' : chars.charAt(e3)) +
      (e4 === 64 ? '=' : chars.charAt(e4));
  }
  return result;
}

/**
 * Convenience for the common case where the SDK needs a unique challenge per
 * call. Pairs with the slot endpoint's nonce — server-side, the slot nonce
 * IS the challenge.
 */
export function generateChallenge(): string {
  return `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 12)}`;
}
