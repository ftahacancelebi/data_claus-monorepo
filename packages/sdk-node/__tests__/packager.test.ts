import { DataClausPackager } from '../src/packager';
import { PackagerError } from '../src/packager-errors';

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function mockFetchOnce(response: { ok: boolean; status: number; body: unknown }) {
  const fetchMock = jest.fn(async (_input: FetchInput, _init?: FetchInit) => ({
    ok: response.ok,
    status: response.status,
    statusText: response.ok ? 'OK' : 'Error',
    json: async () => response.body,
  })) as unknown as typeof fetch;
  (globalThis as { fetch: typeof fetch }).fetch = fetchMock;
  return fetchMock as unknown as jest.Mock;
}

describe('DataClausPackager.create — overrides supplied', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('POSTs with the exact body when all fields are supplied', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 201,
      body: { data: { id: 'pkg_abc', status: 'evaluating' } },
    });

    const packager = new DataClausPackager({
      apiUrl: 'http://api.test',
      authToken: 'jwt-token',
    });

    const rows = Array.from({ length: 10 }, (_, i) => ({
      user_id: `u${i}`,
      timestamp: `2025-05-0${(i % 9) + 1}`,
      value: i,
    }));

    const result = await packager.create({
      title: 'Test Package',
      category: 'fitness',
      description: 'desc',
      rows,
      price: 49.99,
      schemaJson: { user_id: 'string', timestamp: 'timestamp', value: 'number' },
      claimedMetrics: {
        row_count: 10,
        unique_users: 10,
        date_range_start: '2025-05-01',
        date_range_end: '2025-05-09',
      },
    });

    expect(result).toEqual({ id: 'pkg_abc', status: 'evaluating' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/v1/packages');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token');
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe('Test Package');
    expect(body.category).toBe('fitness');
    expect(body.price).toBe(49.99);
    expect(body.schema_json).toEqual({
      user_id: 'string',
      timestamp: 'timestamp',
      value: 'number',
    });
    expect(body.sample_rows).toHaveLength(8);
    expect(body.claimed_metrics.row_count).toBe(10);
  });
});

describe('DataClausPackager.create — auto inference', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('auto-fills schema_json, sample_rows, claimed_metrics from rows', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 201,
      body: { data: { id: 'pkg_xyz', status: 'evaluating' } },
    });

    const packager = new DataClausPackager({
      apiUrl: 'http://api.test',
      authToken: 't',
    });

    const rows = Array.from({ length: 12 }, (_, i) => ({
      user_id: `u${i % 3}`,
      timestamp: `2025-05-${String((i % 28) + 1).padStart(2, '0')}`,
      kind: 'workout',
      minutes: 30 + i,
    }));

    await packager.create({
      title: 'Auto Test',
      category: 'fitness',
      rows,
      price: 19.99,
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.schema_json).toEqual({
      user_id: 'string',
      timestamp: 'timestamp',
      kind: 'string',
      minutes: 'number',
    });
    expect(body.sample_rows).toHaveLength(8);
    expect(body.claimed_metrics.row_count).toBe(12);
    expect(body.claimed_metrics.unique_users).toBe(3);
  });
});

describe('DataClausPackager.create — error paths', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('throws AUTH on 401', async () => {
    mockFetchOnce({ ok: false, status: 401, body: { message: 'no token' } });
    const packager = new DataClausPackager({ apiUrl: 'http://api.test', authToken: 't' });
    const rows = Array.from({ length: 8 }, (_, i) => ({
      user_id: `u${i}`,
      timestamp: '2025-05-01',
    }));
    await expect(
      packager.create({ title: 't', category: 'c', rows, price: 1 }),
    ).rejects.toMatchObject({ code: 'AUTH' });
  });

  it('throws API on 4xx with parsed message', async () => {
    mockFetchOnce({
      ok: false,
      status: 400,
      body: { message: 'title too short' },
    });
    const packager = new DataClausPackager({ apiUrl: 'http://api.test', authToken: 't' });
    const rows = Array.from({ length: 8 }, (_, i) => ({
      user_id: `u${i}`,
      timestamp: '2025-05-01',
    }));
    await expect(
      packager.create({ title: 't', category: 'c', rows, price: 1 }),
    ).rejects.toMatchObject({ code: 'API', message: expect.stringContaining('title too short') });
  });

  it('throws NETWORK when fetch rejects', async () => {
    (globalThis as { fetch: typeof fetch }).fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const packager = new DataClausPackager({ apiUrl: 'http://api.test', authToken: 't' });
    const rows = Array.from({ length: 8 }, (_, i) => ({
      user_id: `u${i}`,
      timestamp: '2025-05-01',
    }));
    await expect(
      packager.create({ title: 't', category: 'c', rows, price: 1 }),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
