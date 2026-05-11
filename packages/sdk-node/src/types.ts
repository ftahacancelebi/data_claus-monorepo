/**
 * Types shared between packager helpers and the Packager class.
 * Mirrors `apps/dataclaus-nestjs-api/src/modules/data-packages/dto/create-package.dto.ts`.
 */

export interface ClaimedMetrics {
  row_count: number;
  unique_users: number;
  /** ISO date string YYYY-MM-DD */
  date_range_start: string;
  /** ISO date string YYYY-MM-DD */
  date_range_end: string;
}

export type PackageStatus =
  | 'pending'
  | 'evaluating'
  | 'certified'
  | 'rejected'
  | 'sold'
  | 'delisted';

export type SchemaJson = Record<string, string>;

export type Row = Record<string, unknown>;
