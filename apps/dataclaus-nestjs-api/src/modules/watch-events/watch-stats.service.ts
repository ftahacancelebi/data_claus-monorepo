import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchEvent } from './entities/watch-event.entity';

@Injectable()
export class WatchStatsService {
  constructor(
    @InjectRepository(WatchEvent)
    private readonly repo: Repository<WatchEvent>,
  ) {}

  async getMyStats(userId: string) {
    const totalEvents = await this.repo.count({ where: { userId } });
    const completedEvents = await this.repo.count({
      where: { userId, completed: true },
    });
    const partialEvents = totalEvents - completedEvents;

    // Actual earnings from data marketplace — only paid when data is sold (data_revenue transactions)
    const earningsRows = await this.repo.manager.query<{ total: string }[]>(
      `SELECT COALESCE(SUM(lt.amount), 0)::text AS total
       FROM ledger_transactions lt
       JOIN wallets w ON lt.dest_wallet_id = w.id
       WHERE w.owner_id = $1 AND lt.type = 'data_revenue' AND lt.amount > 0`,
      [userId],
    );
    const totalEarnedFromData = parseFloat(earningsRows[0]?.total ?? '0');

    // Pool share (anonymized aggregate — no individual data exposed)
    const totalPoolEvents = await this.repo.count();
    const poolContributionPct =
      totalPoolEvents > 0
        ? Math.round((totalEvents / totalPoolEvents) * 1000) / 10
        : 0;

    // Top categories (anonymized — category label only, no video IDs)
    const categoryRows = await this.repo
      .createQueryBuilder('we')
      .select('we.videoCategory', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('we.userId = :userId', { userId })
      .andWhere('we.videoCategory IS NOT NULL')
      .groupBy('we.videoCategory')
      .orderBy('count', 'DESC')
      .limit(8)
      .getRawMany<{ category: string; count: string }>();

    // Top tags — unnest PostgreSQL array column
    const tagRows = await this.repo.manager.query<
      { tag: string; count: string }[]
    >(
      `SELECT unnest(video_tags) AS tag, COUNT(*)::text AS count
       FROM watch_events
       WHERE user_id = $1 AND cardinality(video_tags) > 0
       GROUP BY tag
       ORDER BY count::int DESC
       LIMIT 12`,
      [userId],
    );

    return {
      totalEvents,
      completedEvents,
      partialEvents,
      totalEarnedFromData,
      topCategories: categoryRows.map((r) => ({
        category: r.category,
        count: parseInt(r.count, 10),
      })),
      topTags: tagRows.map((r) => ({
        tag: r.tag,
        count: parseInt(r.count, 10),
      })),
      poolContributionPct,
    };
  }
}
