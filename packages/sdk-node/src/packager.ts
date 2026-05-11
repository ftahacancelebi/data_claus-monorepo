import {
  inferSchema,
  pickSampleRows,
  computeClaimedMetrics,
} from './packager-helpers';
import { PackagerError } from './packager-errors';
import type { ClaimedMetrics, PackageStatus, Row, SchemaJson } from './types';

export interface PackagerConfig {
  apiUrl: string;
  authToken: string;
}

export interface CreatePackageInput {
  title: string;
  category: string;
  description?: string;
  rows: Row[];
  price: number;
  applicationId?: string;
  userField?: string;
  timestampField?: string;
  schemaJson?: SchemaJson;
  claimedMetrics?: ClaimedMetrics;
}

export interface CreatePackageResult {
  id: string;
  status: PackageStatus;
}

interface ApiSuccess<T> {
  data: T;
  statusCode?: number;
  message?: string;
}

interface ApiError {
  message?: string;
  error?: string;
}

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as ApiSuccess<T>).data;
  }
  return body as T;
}

export class DataClausPackager {
  protected readonly apiUrl: string;
  protected readonly authToken: string;

  constructor(config: PackagerConfig) {
    if (!config.apiUrl) {
      throw new PackagerError('VALIDATION', 'PackagerConfig.apiUrl is required');
    }
    if (!config.authToken) {
      throw new PackagerError('VALIDATION', 'PackagerConfig.authToken is required');
    }
    this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    this.authToken = config.authToken;
  }

  async create(input: CreatePackageInput): Promise<CreatePackageResult> {
    if (!Array.isArray(input.rows) || input.rows.length === 0) {
      throw new PackagerError('VALIDATION', 'rows must be a non-empty array');
    }

    const sample_rows = pickSampleRows(input.rows, 8);
    const schema_json = input.schemaJson ?? inferSchema(input.rows);
    const claimed_metrics =
      input.claimedMetrics ??
      computeClaimedMetrics(input.rows, {
        userField: input.userField,
        timestampField: input.timestampField,
      });

    const body = {
      title: input.title,
      description: input.description,
      category: input.category,
      claimed_metrics,
      schema_json,
      sample_rows,
      price: input.price,
      application_id: input.applicationId,
    };

    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/v1/packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new PackagerError('NETWORK', `network error: ${(err as Error).message}`, err);
    }

    const json = (await response.json().catch(() => null)) as unknown;

    if (response.status === 401 || response.status === 403) {
      throw new PackagerError(
        'AUTH',
        `unauthorized: ${(json as ApiError)?.message ?? response.statusText}`,
      );
    }
    if (!response.ok) {
      throw new PackagerError(
        'API',
        `package create failed (${response.status}): ${
          (json as ApiError)?.message ?? response.statusText
        }`,
      );
    }

    const data = unwrap<CreatePackageResult>(json);
    return { id: data.id, status: data.status };
  }

  static async login(opts: {
    apiUrl: string;
    email: string;
    password: string;
  }): Promise<DataClausPackager> {
    const base = opts.apiUrl.replace(/\/+$/, '');
    let response: Response;
    try {
      response = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: opts.email, password: opts.password }),
      });
    } catch (err) {
      throw new PackagerError('NETWORK', `network error during login: ${(err as Error).message}`, err);
    }
    const json = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new PackagerError(
        'AUTH',
        `login failed (${response.status}): ${(json as ApiError)?.message ?? response.statusText}`,
      );
    }
    const data = unwrap<{ accessToken: string }>(json);
    if (!data?.accessToken) {
      throw new PackagerError('AUTH', 'login response did not contain accessToken');
    }
    return new DataClausPackager({ apiUrl: base, authToken: data.accessToken });
  }
}
