import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Application } from '../../application/entities/application.entity';
import {
  EXTRACT_DEFAULT_RANGE_DAYS,
  EXTRACT_MIN_ROWS,
  EXTRACT_MIN_UNIQUE_USERS,
  EXTRACT_SAMPLE_HIGH_QUALITY,
  EXTRACT_SAMPLE_LOW_QUALITY,
  EVENT_TYPE_TO_CATEGORY,
  PRICE_BASELINE_USD_PER_ROW,
} from './extractor.constants';
import { EligibleApplicationDto } from './dto/eligible-application.dto';
import { ExtractedPackageDraftDto } from './dto/extract-preview.dto';

interface AggRow {
  row_count: string;
  unique_users: string;
  min_date: string;
  max_date: string;
}

interface DistRow {
  event_type: string;
  type_count: string;
}

interface SampleRow {
  user_id: string;
  event_type: string;
  quality_score: string;
  session_id: string | null;
  ingested_at: string;
}

const SCHEMA_JSON: Record<string, string> = {
  user_pseudo_id: 'string',
  event_type:     'string',
  sensor_class:   'string',
  quality_score:  'number',
  session_id:     'string',
  recorded_at:    'timestamp',
};

@Injectable()
export class ApplicationExtractorService {
  private readonly logger = new Logger(ApplicationExtractorService.name);

  constructor(
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async listEligible(developerId: string): Promise<EligibleApplicationDto[]> {
    const apps = await this.appRepo.find({ where: { developerId } });
    const results: EligibleApplicationDto[] = [];
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // N+1 accepted; developer app count is small (same pattern as data-packages.service.ts)
    for (const app of apps) {
      const [agg] = await this.dataSource.query<AggRow[]>(
        `SELECT COUNT(*) AS row_count, COUNT(DISTINCT user_id) AS unique_users
         FROM scored_events WHERE application_id = $1 AND ingested_at BETWEEN $2 AND $3`,
        [app.id, from, now],
      );
      const rowCount = parseInt(agg?.row_count ?? '0', 10);
      const uniqueUsers = parseInt(agg?.unique_users ?? '0', 10);
      const eligible = rowCount >= EXTRACT_MIN_ROWS && uniqueUsers >= EXTRACT_MIN_UNIQUE_USERS;
      results.push({
        id: app.id,
        name: app.name,
        category: app.category ?? null,
        event_count: rowCount,
        unique_users: uniqueUsers,
        eligible,
        reason: eligible
          ? undefined
          : rowCount < EXTRACT_MIN_ROWS
          ? `Needs at least ${EXTRACT_MIN_ROWS} events to package (has ${rowCount})`
          : `Needs at least ${EXTRACT_MIN_UNIQUE_USERS} unique users (has ${uniqueUsers})`,
      });
    }
    return results;
  }

  async extract(
    appId: string,
    requesterId: string,
    requesterRole: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<ExtractedPackageDraftDto> {
    const app = await this.appRepo.findOne({ where: { id: appId } });
    if (!app) throw new NotFoundException('Application not found');
    if (requesterRole !== 'admin' && app.developerId !== requesterId) {
      throw new ForbiddenException('You do not own this application');
    }

    const to = dateRange?.to ?? new Date();
    const from = dateRange?.from ?? new Date(to.getTime() - EXTRACT_DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

    const [agg] = await this.dataSource.query<AggRow[]>(
      `SELECT COUNT(*) AS row_count, COUNT(DISTINCT user_id) AS unique_users,
              MIN(ingested_at) AS min_date, MAX(ingested_at) AS max_date
       FROM scored_events WHERE application_id = $1 AND ingested_at BETWEEN $2 AND $3`,
      [appId, from, to],
    );
    const rowCount = parseInt(agg?.row_count ?? '0', 10);
    const uniqueUsers = parseInt(agg?.unique_users ?? '0', 10);

    if (rowCount < EXTRACT_MIN_ROWS) {
      throw new BadRequestException(
        `Not enough events to package — needs ${EXTRACT_MIN_ROWS}, found ${rowCount}`,
      );
    }
    if (uniqueUsers < EXTRACT_MIN_UNIQUE_USERS) {
      throw new BadRequestException(
        `Not enough unique users — needs ${EXTRACT_MIN_UNIQUE_USERS}, found ${uniqueUsers}`,
      );
    }

    const distRows = await this.dataSource.query<DistRow[]>(
      `SELECT event_type, COUNT(*) AS type_count
       FROM scored_events WHERE application_id = $1 AND ingested_at BETWEEN $2 AND $3
       GROUP BY event_type`,
      [appId, from, to],
    );
    const distMap: Record<string, number> = {};
    for (const row of distRows) {
      distMap[row.event_type] = parseInt(row.type_count, 10);
    }

    const highQuality = await this.dataSource.query<SampleRow[]>(
      `SELECT user_id, event_type, quality_score, session_id, ingested_at
       FROM scored_events WHERE application_id = $1 AND ingested_at BETWEEN $2 AND $3
       AND quality_score >= 0.6 ORDER BY RANDOM() LIMIT $4`,
      [appId, from, to, EXTRACT_SAMPLE_HIGH_QUALITY],
    );
    const lowQuality = await this.dataSource.query<SampleRow[]>(
      `SELECT user_id, event_type, quality_score, session_id, ingested_at
       FROM scored_events WHERE application_id = $1 AND ingested_at BETWEEN $2 AND $3
       AND quality_score < 0.6 ORDER BY RANDOM() LIMIT $4`,
      [appId, from, to, EXTRACT_SAMPLE_LOW_QUALITY],
    );
    const allSamples = [...highQuality, ...lowQuality].sort(() => Math.random() - 0.5);
    const sampleRows = this.anonymizeSamples(allSamples, appId);

    const flaggedCount = allSamples.filter(r => parseFloat(r.quality_score) < 0.3).length;
    const category = this.suggestCategory(distMap, app.category ?? null);
    const price = this.suggestPrice(rowCount, category);
    const quarter = `Q${Math.ceil((to.getMonth() + 1) / 3)} ${to.getFullYear()}`;
    const title = `${app.name} ${this.capitalize(category)} Telemetry ${quarter}`;

    return {
      title,
      category,
      claimed_metrics: {
        row_count: rowCount,
        unique_users: uniqueUsers,
        date_range_start: agg?.min_date?.split('T')[0] ?? from.toISOString().split('T')[0],
        date_range_end:   agg?.max_date?.split('T')[0] ?? to.toISOString().split('T')[0],
      },
      schema_json: SCHEMA_JSON,
      sample_rows: sampleRows,
      price,
      application_id: appId,
      ui_meta: {
        application_name: app.name,
        suggested_price_basis: `${category} baseline × ${rowCount.toLocaleString()} rows`,
        flagged_sample_count: flaggedCount,
      },
    };
  }

  anonymizeUserId(userId: string, appId: string): string {
    const hash = crypto.createHash('sha256').update(userId + appId).digest('hex');
    return `u_${hash.slice(0, 8)}`;
  }

  suggestCategory(distMap: Record<string, number>, appCategory: string | null): string {
    let maxCount = 0;
    let best: string | null = null;
    for (const [eventType, count] of Object.entries(distMap)) {
      const cat = EVENT_TYPE_TO_CATEGORY[eventType];
      if (cat && count > maxCount) {
        maxCount = count;
        best = cat;
      }
    }
    return best ?? appCategory ?? 'other';
  }

  private suggestPrice(rowCount: number, category: string): number {
    const baseline = PRICE_BASELINE_USD_PER_ROW[category] ?? 0.0004;
    return Math.round(rowCount * baseline * 100) / 100;
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private anonymizeSamples(rows: SampleRow[], appId: string): Array<Record<string, unknown>> {
    return rows.map(r => ({
      user_pseudo_id: this.anonymizeUserId(r.user_id, appId),
      event_type:     r.event_type,
      sensor_class:   this.sensorClass(r.event_type),
      quality_score:  parseFloat(parseFloat(r.quality_score).toFixed(4)),
      session_id:     r.session_id
        ? `s_${crypto.createHash('sha256').update(r.session_id + appId).digest('hex').slice(0, 6)}`
        : null,
      recorded_at:    r.ingested_at,
    }));
  }

  private sensorClass(eventType: string): string {
    const MAP: Record<string, string> = {
      accelerometer: 'motion',
      gyroscope:     'motion',
      scroll:        'interaction',
      screen_view:   'navigation',
      touch:         'interaction',
    };
    return MAP[eventType] ?? 'other';
  }
}
