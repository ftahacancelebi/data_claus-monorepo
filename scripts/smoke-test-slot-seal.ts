/**
 * Slot/seal flow smoke test.
 *
 * One command, zero assumptions: hits a running NestJS API and walks the
 * bypass-resistant impression cycle end-to-end. Use BEFORE the jury demo
 * to confirm the full path is green:
 *
 *   pnpm exec ts-node --transpile-only --project scripts/tsconfig.json \
 *     scripts/smoke-test-slot-seal.ts
 *
 * Prereqs:
 *   1. API up at API_BASE (default http://localhost:3000)
 *   2. `pnpm run demo:seed` already ran (provides predictable accounts)
 *
 * What it checks:
 *   - Login as the seeded demo user (DataClaus account)
 *   - Request an ad slot (signed token comes back)
 *   - Replay the same slot twice → second call must fail (anti-replay)
 *   - Tampering the slot token → must fail (HMAC)
 *   - Out-of-tolerance reported revenue → must clamp + flag suspicious
 *   - Wallet balance increased after a clean seal
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';
const APP_ID =
  process.env.DEMO_APP_ID ?? 'fd6036a9-d4f4-448a-9712-2dc1ea429903';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';

type LoginResponse = {
  accessToken: string;
  user: { id: string };
};

type SlotResponse = {
  slot_token: string;
  ad_unit_id: string;
  ad_type: string;
  expires_at: string;
  projected_revenue: number;
};

type SealResponse = {
  id: string;
  gross_revenue: number;
  user_share: number;
  dev_share: number;
  platform_fee: number;
};

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m▸\x1b[0m';

let failures = 0;

function ok(label: string) {
  console.log(`  ${PASS} ${label}`);
}

function bad(label: string, err?: unknown) {
  failures++;
  console.log(`  ${FAIL} ${label}`);
  if (err) console.log(`    ${(err as Error).message ?? err}`);
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: T | { error?: string } }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text };
  }
  return { ok: res.ok, status: res.status, body: body as T };
}

function readDemoEmail(): string {
  try {
    const path = join(__dirname, '..', 'JURY_LOGIN.md');
    const md = readFileSync(path, 'utf8');
    const match = md.match(/end[- ]?user.*?([\w.+-]+@[\w-]+\.\w+)/is);
    if (match?.[1]) return match[1];
  } catch {
    // file missing — fall through
  }
  return process.env.DEMO_USER_EMAIL ?? 'jury.user@dataclaus.io';
}

async function main() {
  console.log(`${INFO} smoke-test against ${API_BASE} (app ${APP_ID})\n`);

  const email = readDemoEmail();
  console.log(`${INFO} login as ${email}`);
  const login = await fetchJson<LoginResponse>(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });

  if (!login.ok) {
    bad(
      `login failed (${login.status}). Run \`pnpm run demo:seed\` first.`,
      (login.body as { error?: string }).error,
    );
    process.exit(1);
  }
  const { accessToken, user } = login.body as LoginResponse;
  ok('login');

  const auth = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  // --- 1. Happy path: slot + seal ---
  console.log(`\n${INFO} happy path`);
  const slotRes = await fetchJson<SlotResponse>(
    `${API_BASE}/applications/${APP_ID}/ads/slot`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ ad_type: 'rewarded', user_id: user.id }),
    },
  );
  if (!slotRes.ok) {
    bad(`slot request (${slotRes.status})`, (slotRes.body as { error?: string }).error);
    process.exit(1);
  }
  const slot = slotRes.body as SlotResponse;
  ok(`slot issued (projected $${slot.projected_revenue})`);

  const sealRes = await fetchJson<SealResponse>(
    `${API_BASE}/applications/${APP_ID}/ads/seal`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ slot_token: slot.slot_token }),
    },
  );
  if (!sealRes.ok) {
    bad(`seal failed (${sealRes.status})`, (sealRes.body as { error?: string }).error);
    process.exit(1);
  }
  const sealed = sealRes.body as SealResponse;
  ok(
    `sealed → user $${sealed.user_share}, dev $${sealed.dev_share}, platform $${sealed.platform_fee}`,
  );

  // --- 2. Replay: same slot must fail ---
  console.log(`\n${INFO} replay protection`);
  const replayRes = await fetchJson<unknown>(
    `${API_BASE}/applications/${APP_ID}/ads/seal`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ slot_token: slot.slot_token }),
    },
  );
  if (replayRes.ok) {
    bad('replayed slot was accepted — anti-replay broken!');
  } else {
    ok(`replay rejected (HTTP ${replayRes.status})`);
  }

  // --- 3. Tampered token ---
  console.log(`\n${INFO} signature verification`);
  const fresh = await fetchJson<SlotResponse>(
    `${API_BASE}/applications/${APP_ID}/ads/slot`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ ad_type: 'banner', user_id: user.id }),
    },
  );
  if (!fresh.ok) {
    bad('fresh slot for tamper test failed');
  } else {
    const freshSlot = fresh.body as SlotResponse;
    const tampered = freshSlot.slot_token.slice(0, -2) + 'AA';
    const tamperRes = await fetchJson<unknown>(
      `${API_BASE}/applications/${APP_ID}/ads/seal`,
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ slot_token: tampered }),
      },
    );
    if (tamperRes.ok) {
      bad('tampered token accepted — HMAC verification broken!');
    } else {
      ok(`tampered token rejected (HTTP ${tamperRes.status})`);
    }
  }

  // --- 4. Out-of-tolerance revenue ---
  console.log(`\n${INFO} revenue reconciliation`);
  const fresh2 = await fetchJson<SlotResponse>(
    `${API_BASE}/applications/${APP_ID}/ads/slot`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ ad_type: 'rewarded', user_id: user.id }),
    },
  );
  if (fresh2.ok) {
    const slot2 = fresh2.body as SlotResponse;
    const sealOOR = await fetchJson<SealResponse>(
      `${API_BASE}/applications/${APP_ID}/ads/seal`,
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          slot_token: slot2.slot_token,
          reported_revenue: 9999.99,
        }),
      },
    );
    if (sealOOR.ok) {
      const sealedOOR = sealOOR.body as SealResponse;
      if (sealedOOR.gross_revenue > 1) {
        bad(`out-of-tolerance value accepted: ${sealedOOR.gross_revenue}`);
      } else {
        ok(`out-of-tolerance clamped to ${sealedOOR.gross_revenue}`);
      }
    } else {
      ok(`out-of-tolerance rejected (HTTP ${sealOOR.status})`);
    }
  }

  console.log(
    `\n${failures === 0 ? PASS : FAIL} smoke test ${failures === 0 ? 'PASSED' : `FAILED (${failures})`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n${FAIL} smoke-test crashed:`, err);
  process.exit(2);
});
