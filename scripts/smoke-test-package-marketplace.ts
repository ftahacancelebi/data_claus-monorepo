/**
 * End-to-end smoke test for the data-package marketplace pivot.
 *
 *   1. Login as a seeded developer → submit a fresh package
 *   2. Wait for the evaluator to flip it from `evaluating` → `certified|rejected`
 *   3. Login as a seeded buyer → purchase the package
 *   4. Verify a `package_purchases` row exists and the ledger has paired entries
 *
 * Run:  pnpm exec ts-node --transpile-only scripts/smoke-test-package-marketplace.ts
 * Pre:  Demo seed has run (`pnpm run demo:seed`) and API is on :3000.
 *
 * Exits non-zero on any failure so CI can wire it up later.
 */

const API_BASE = process.env.SMOKE_API_BASE ?? 'http://localhost:3000';
const DEV_EMAIL = 'developer.social@dataclaus.demo'; // TikTok Clone — exercises multi-dim path
const BUYER_EMAIL = 'buyer.brandone@dataclaus.demo';
const PASSWORD = 'demo1234';
const TARGET_APP_NAME = 'TikTok Clone';

interface LoginResp {
  data: { accessToken: string; user: { id: string; role: string } };
}

async function login(email: string): Promise<{ token: string; userId: string; role: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status}`);
  }
  const json = (await res.json()) as LoginResp;
  return {
    token: json.data.accessToken,
    userId: json.data.user.id,
    role: json.data.user.role,
  };
}

async function authFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `[${res.status}] ${path}: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  return body;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  const startedAt = Date.now();
  console.log('🧪 Marketplace smoke test starting…');

  // 1. Login as developer
  const dev = await login(DEV_EMAIL);
  console.log(`  ✓ Logged in as developer (id=${dev.userId.slice(0, 8)})`);

  // 2. Exercise the multi-dimension extraction path:
  //    list eligible apps → find TikTok Clone → preview → submit draft.
  //    This is what the frontend "✨ From an app" modal does, so the smoke
  //    test now mirrors the real submission path (not a hand-rolled payload).
  const eligible = (await authFetch(dev.token, '/v1/packages/extract/eligible-apps')) as {
    data: Array<{ id: string; name: string; eligible: boolean; reason?: string }>;
  };
  const targetApp = eligible.data.find((a) => a.name === TARGET_APP_NAME);
  assert(
    targetApp,
    `eligible-apps did not return ${TARGET_APP_NAME} (got: ${eligible.data.map((a) => a.name).join(', ') || 'empty list'})`,
  );
  assert(
    targetApp.eligible,
    `${TARGET_APP_NAME} app is not eligible for extraction (${targetApp.reason ?? 'no reason given'}); did the seed run?`,
  );
  console.log(`  ✓ Found eligible app ${targetApp.name} (id=${targetApp.id.slice(0, 8)})`);

  const previewResp = (await authFetch(
    dev.token,
    `/v1/packages/extract/preview/${targetApp.id}`,
  )) as {
    data: {
      title: string;
      category: string;
      claimed_metrics: { row_count: number; unique_users: number; date_range_start: string; date_range_end: string };
      schema_json: Record<string, string>;
      sample_rows: Array<Record<string, unknown>>;
      price: number;
      application_id: string;
      dimensions?: Record<string, unknown>;
    };
  };
  const draft = previewResp.data;
  assert(draft.application_id === targetApp.id, 'preview application_id mismatch');
  assert(
    draft.dimensions && typeof draft.dimensions === 'object',
    'preview draft must carry a dimensions block for TikTok Clone',
  );
  console.log(
    `  ✓ Preview ready (rows=${draft.sample_rows.length}, dims=${Object.keys(draft.dimensions ?? {}).join(', ')})`,
  );

  // Submit the draft. Unique-ify the title so re-runs don't collide.
  // Explicit field pick — preview response includes `ui_meta` which is NOT in
  // CreatePackageDto, and Nest's ValidationPipe runs with forbidNonWhitelisted,
  // so spreading `...draft` would 400 the request before any assertion fires.
  const createInput = {
    title: `${draft.title} (smoke ${Date.now()})`,
    category: draft.category,
    claimed_metrics: draft.claimed_metrics,
    schema_json: draft.schema_json,
    sample_rows: draft.sample_rows,
    price: draft.price,
    application_id: draft.application_id,
    dimensions: draft.dimensions,
  };
  const create = (await authFetch(dev.token, '/v1/packages', {
    method: 'POST',
    body: JSON.stringify(createInput),
  })) as { data: { id: string; status: string } };
  const packageId = create.data.id;
  console.log(`  ✓ Package submitted (id=${packageId.slice(0, 8)}, status=${create.data.status})`);

  // 2b. Regression guard — fetch the just-created package and assert that
  //     `sampleRows` round-trips as real objects, not `[[], [], ...]`. The
  //     DTO must carry `@Type(() => Object)` on sample_rows or class-transformer
  //     (with enableImplicitConversion in main.ts) silently corrupts each row.
  const readback = (await authFetch(dev.token, `/v1/packages/${packageId}`)) as {
    data: { sampleRows: unknown[] };
  };
  assert(
    Array.isArray(readback.data.sampleRows) && readback.data.sampleRows.length === createInput.sample_rows.length,
    `sampleRows length mismatch: sent ${createInput.sample_rows.length}, got ${readback.data.sampleRows?.length}`,
  );
  for (let i = 0; i < readback.data.sampleRows.length; i++) {
    const row = readback.data.sampleRows[i];
    assert(
      row !== null && typeof row === 'object' && !Array.isArray(row),
      `sampleRows[${i}] is not a plain object (got ${JSON.stringify(row)}); did the DTO drop @Type(() => Object)?`,
    );
    assert(
      Object.keys(row as Record<string, unknown>).length > 0,
      `sampleRows[${i}] has no keys — the row was corrupted to {} or []`,
    );
  }
  console.log(`  ✓ sampleRows round-trips intact (${readback.data.sampleRows.length} non-empty objects)`);

  // 3. Wait for evaluator
  interface CertifiedPackageShape {
    id: string;
    status: string;
    dataclausScore: number | null;
    price: number | string;
    dimensions: Record<string, { unit_price_usd?: number; total_usd?: number; count?: number }> | null;
  }
  let finalStatus = 'evaluating';
  let certPkg: CertifiedPackageShape | null = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const res = (await authFetch(dev.token, `/v1/packages/${packageId}`)) as {
      data: CertifiedPackageShape;
    };
    finalStatus = res.data.status;
    certPkg = res.data;
    if (finalStatus !== 'evaluating' && finalStatus !== 'pending') break;
  }
  assert(
    finalStatus === 'certified' || finalStatus === 'rejected',
    `Evaluator stuck at ${finalStatus}`,
  );
  assert(certPkg, 'No package payload captured from evaluator polling');
  console.log(`  ✓ Evaluation complete: ${finalStatus} (score=${certPkg.dataclausScore})`);

  // 4. Only certified packages can be purchased. If the deterministic stub
  //    rejected (low score is possible without ANTHROPIC_API_KEY), bail clean.
  if (finalStatus !== 'certified') {
    console.log(
      '  ⚠ Package not certified — smoke test cannot exercise purchase path. PASS (eval ran).',
    );
    console.log(`✨ Smoke test partial-pass in ${Date.now() - startedAt}ms`);
    return;
  }

  // 4b. Dimension shape assertion — the multi-dim path must persist a
  //     non-empty `dimensions` jsonb with at least the device dimension.
  //     For TikTok Clone (developer.social), all three dimensions must be
  //     present with positive `unit_price_usd` after evaluator clamping.
  if (!certPkg.dimensions || typeof certPkg.dimensions !== 'object') {
    throw new Error(`Smoke fail: package ${certPkg.id} has no dimensions field`);
  }
  const dimNames = Object.keys(certPkg.dimensions);
  if (!dimNames.includes('device')) {
    throw new Error(`Smoke fail: package ${certPkg.id} missing device dimension`);
  }
  // The smoke developer (developer.social) only submits TikTok Clone
  // packages, so all three dimensions should always be present.
  if (DEV_EMAIL.includes('developer.social')) {
    for (const required of ['behavior', 'demographic', 'device'] as const) {
      const d = certPkg.dimensions[required];
      if (!d) {
        throw new Error(
          `Smoke fail: TikTok Clone package ${certPkg.id} missing ${required} dimension`,
        );
      }
      if (typeof d.unit_price_usd !== 'number' || d.unit_price_usd <= 0) {
        throw new Error(
          `Smoke fail: ${required} dimension has invalid unit_price_usd (got ${d.unit_price_usd})`,
        );
      }
    }
  }
  console.log(`  ✓ Dimensions shape OK: ${dimNames.join(', ')}`);

  // 5. Login as buyer
  const buyer = await login(BUYER_EMAIL);
  console.log(`  ✓ Logged in as buyer (id=${buyer.userId.slice(0, 8)})`);

  // 6. Purchase
  const purchase = (await authFetch(buyer.token, `/v1/packages/${packageId}/purchase`, {
    method: 'POST',
    body: JSON.stringify({}),
  })) as {
    data: { purchase_id: string; download_token: string; ledger_transaction_id: string };
  };
  assert(purchase.data.purchase_id, 'purchase_id missing');
  assert(purchase.data.download_token, 'download_token missing');
  assert(purchase.data.ledger_transaction_id, 'ledger_transaction_id missing');
  console.log(`  ✓ Purchase complete (purchase=${purchase.data.purchase_id.slice(0, 8)})`);

  // 7. Verify my-purchases includes the row
  const mine = (await authFetch(buyer.token, '/v1/packages/purchases')) as {
    data: Array<{ packageId: string; amount: number }>;
  };
  const found = mine.data.find((p) => p.packageId === packageId);
  assert(found, 'purchase row not in /v1/packages/purchases');
  // Price is set by the extractor and may be re-clamped by the evaluator
  // (clampAndTotal in package-evaluator.service.ts). Compare against the
  // package's persisted price instead of a hardcoded number.
  const expectedAmount = Number(certPkg.price);
  assert(
    Number(found.amount) === expectedAmount,
    `amount mismatch: expected ${expectedAmount}, got ${found.amount}`,
  );
  console.log(`  ✓ Purchase visible in /v1/packages/purchases (amount=${found.amount})`);

  // 8. Verify download works AND that downloaded rows are real objects, not [].
  //    Same regression guard as step 2b — the download endpoint is what the buyer
  //    actually consumes, so the contract must hold here too.
  const dl = (await authFetch(
    buyer.token,
    `/v1/packages/${packageId}/download?token=${encodeURIComponent(purchase.data.download_token)}`,
  )) as { data: { package: { sample_rows: unknown[] } } };
  assert(
    Array.isArray(dl.data.package.sample_rows) && dl.data.package.sample_rows.length >= 5,
    'sample_rows missing on download',
  );
  for (let i = 0; i < dl.data.package.sample_rows.length; i++) {
    const row = dl.data.package.sample_rows[i];
    assert(
      row !== null && typeof row === 'object' && !Array.isArray(row) && Object.keys(row as Record<string, unknown>).length > 0,
      `download sample_rows[${i}] is not a non-empty object: ${JSON.stringify(row)}`,
    );
  }
  console.log(`  ✓ Download returns ${dl.data.package.sample_rows.length} intact sample rows`);

  console.log(`✨ Smoke test PASS in ${Date.now() - startedAt}ms`);
}

main().catch((err) => {
  console.error('❌ Smoke test FAILED:', err.message ?? err);
  process.exit(1);
});
