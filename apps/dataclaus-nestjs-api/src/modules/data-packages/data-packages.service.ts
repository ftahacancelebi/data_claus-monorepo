import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { Wallet } from '../wallet/entities';
import { FinancialTxService } from '../ledger/financial-tx.service';
import {
  PackageStatus,
  PLATFORM_FEE_PERCENT,
  DEFAULT_USER_SHARE_PERCENT,
  SYSTEM_WALLET_IDS,
  TransactionType,
  WalletType,
} from '../../common/constants';
import { Application } from '../application/entities/application.entity';
import { DataPackage } from './entities/data-package.entity';
import { PackagePurchase } from './entities/package-purchase.entity';
import { CreatePackageDto, ListPackagesDto } from './dto';
import { PackageEvaluatorService } from './package-evaluator.service';
import { DimensionsMap, DimensionsMapValued } from './dto/dimension-payload.dto';

import type { CurrentUserData } from '../../common/decorators/current-user.decorator';

@Injectable()
export class DataPackagesService {
  private readonly logger = new Logger(DataPackagesService.name);

  constructor(
    @InjectRepository(DataPackage)
    private readonly packageRepo: Repository<DataPackage>,
    @InjectRepository(PackagePurchase)
    private readonly purchaseRepo: Repository<PackagePurchase>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
    private readonly evaluator: PackageEvaluatorService,
    private readonly financialTx: FinancialTxService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------------------
  // CREATE / EVALUATE
  // ---------------------------------------------------------------------------

  async create(developerId: string, dto: CreatePackageDto): Promise<DataPackage> {
    this.assertSampleRowsValid(dto);

    const pkg = this.packageRepo.create({
      developerId,
      applicationId: dto.application_id ?? null,
      title: dto.title.trim(),
      description: dto.description ?? null,
      category: dto.category.toLowerCase(),
      claimedMetrics: dto.claimed_metrics,
      schemaJson: dto.schema_json,
      sampleRows: dto.sample_rows,
      price: dto.price,
      status: PackageStatus.EVALUATING,
      dataclausScore: null,
      llmEvaluation: null,
      evaluatedAt: null,
    });

    // Auto-extract flow: persist raw dimensions payload (evaluator will
    // enrich with per-dim valuations later in runEvaluationAsync). Also
    // backfill the legacy flat fields from the `device` dimension so the
    // old buyer UI (which still reads claimedMetrics / schemaJson /
    // sampleRows) keeps rendering. Only backfill when the DTO didn't
    // supply the flat shape — the flat fields remain the source of truth
    // when both are present.
    if (dto.dimensions) {
      pkg.dimensions = dto.dimensions as any;

      const deviceDim = (dto.dimensions as any).device;
      if (deviceDim) {
        if (!pkg.claimedMetrics) {
          const today = new Date().toISOString().slice(0, 10);
          pkg.claimedMetrics = {
            row_count: deviceDim.count,
            unique_users: deviceDim.distribution?.['unique_users'] ?? 0,
            date_range_start: today,
            date_range_end: today,
          };
        }
        if (!pkg.schemaJson || Object.keys(pkg.schemaJson).length === 0) {
          pkg.schemaJson = deviceDim.schema_json;
        }
        if (!pkg.sampleRows || pkg.sampleRows.length === 0) {
          pkg.sampleRows = deviceDim.sample_rows;
        }
      }
    }

    const saved = await this.packageRepo.save(pkg);

    // Fire-and-forget evaluation. We deliberately do NOT await — the
    // controller returns immediately with `status: 'evaluating'` and the
    // client polls/listens for the flip to certified/rejected.
    this.eventEmitter.emit('package.created', { packageId: saved.id });
    void this.runEvaluationAsync(saved.id);

    return saved;
  }

  /**
   * Re-run the evaluator on an existing package (admin tool / Phase 2 retry).
   */
  async reevaluate(packageId: string): Promise<DataPackage> {
    const pkg = await this.packageRepo.findOne({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    pkg.status = PackageStatus.EVALUATING;
    await this.packageRepo.save(pkg);
    void this.runEvaluationAsync(pkg.id);
    return pkg;
  }

  private async runEvaluationAsync(packageId: string): Promise<void> {
    try {
      const pkg = await this.packageRepo.findOne({ where: { id: packageId } });
      if (!pkg) return;
      const evaluation = await this.evaluator.evaluate(pkg);

      // If this package was built from extracted dimensions, clamp the
      // LLM's per-dim unit prices to the industry band and compute totals.
      // The package's `dimensions` column holds the raw `DimensionsMap`
      // (pre-valuation) at this point — replace it with the valued shape.
      const dimensionsValued: DimensionsMapValued | null = pkg.dimensions
        ? this.evaluator.clampAndTotal(
            pkg.dimensions as unknown as DimensionsMap,
            evaluation.dimensions,
          )
        : null;

      pkg.llmEvaluation = evaluation;
      pkg.dimensions = dimensionsValued;
      pkg.dataclausScore = evaluation.trust_score;
      pkg.status =
        evaluation.verdict === 'certified'
          ? PackageStatus.CERTIFIED
          : PackageStatus.REJECTED;
      pkg.evaluatedAt = new Date();

      if (dimensionsValued) {
        const total = Object.values(dimensionsValued).reduce(
          (sum, d) => sum + (d?.total_usd ?? 0),
          0,
        );
        if (total > 0) pkg.price = total;
      }

      await this.packageRepo.save(pkg);

      this.eventEmitter.emit('package.evaluated', {
        packageId: pkg.id,
        developerId: pkg.developerId,
        status: pkg.status,
        score: evaluation.trust_score,
      });
    } catch (err) {
      this.logger.error(
        `Evaluation failed for package ${packageId}: ${(err as Error).message}`,
      );
      await this.packageRepo.update(
        { id: packageId },
        {
          status: PackageStatus.REJECTED,
          llmEvaluation: {
            trust_score: 0,
            summary: 'Automatic evaluation failed; resubmit or contact support.',
            red_flags: ['Evaluator threw an error.'],
            buyer_match: [],
            rubric: {
              schema_integrity: 0,
              sample_diversity: 0,
              bot_signature_absence: 0,
              claim_evidence_alignment: 0,
              price_fairness: 0,
            },
            confidence: 'low',
            verdict: 'rejected',
          },
          dataclausScore: 0,
          evaluatedAt: new Date(),
        },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  async listPublic(query: ListPackagesDto): Promise<{
    data: DataPackage[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: FindOptionsWhere<DataPackage> = {
      status: PackageStatus.CERTIFIED,
    };
    if (query.category) where.category = query.category.toLowerCase();
    if (typeof query.min_score === 'number') {
      where.dataclausScore = MoreThanOrEqual(query.min_score);
    }
    if (typeof query.max_price === 'number') {
      where.price = LessThanOrEqual(query.max_price);
    }
    const [data, total] = await this.packageRepo.findAndCount({
      where,
      order: { dataclausScore: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit } };
  }

  async listMine(developerId: string): Promise<DataPackage[]> {
    return this.packageRepo.find({
      where: { developerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOnePublic(id: string, viewer: CurrentUserData | null): Promise<DataPackage> {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.status === PackageStatus.CERTIFIED || pkg.status === PackageStatus.SOLD) {
      return pkg;
    }
    // Non-listed packages: only owner or admin sees them.
    if (!viewer) throw new NotFoundException('Package not found');
    if (viewer.role !== 'admin' && viewer.id !== pkg.developerId) {
      throw new NotFoundException('Package not found');
    }
    return pkg;
  }

  async findOneForAdmin(id: string): Promise<DataPackage> {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  // ---------------------------------------------------------------------------
  // PURCHASE
  // ---------------------------------------------------------------------------

  async purchase(packageId: string, buyerId: string): Promise<PackagePurchase> {
    const pkg = await this.packageRepo.findOne({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.status !== PackageStatus.CERTIFIED && pkg.status !== PackageStatus.SOLD) {
      throw new BadRequestException(
        `Package not available for purchase (status=${pkg.status})`,
      );
    }
    if (pkg.developerId === buyerId) {
      throw new BadRequestException('Cannot purchase your own package');
    }

    // Resolve wallets BEFORE opening the transaction — fail fast on missing
    // accounts so we don't waste a tx round-trip.
    const buyerWallet = await this.findBuyerWallet(buyerId);
    if (!buyerWallet) {
      throw new BadRequestException('Buyer has no wallet provisioned');
    }
    if (Number(buyerWallet.balance) < Number(pkg.price)) {
      throw new BadRequestException('Insufficient balance');
    }
    const sellerWallet = await this.findDeveloperWallet(pkg.developerId);
    if (!sellerWallet) {
      throw new ConflictException('Seller wallet missing — contact support');
    }

    const price = Number(pkg.price);

    // Use the application's configured revenue share.
    // Falls back to DEFAULT_USER_SHARE_PERCENT when no app is linked or share is unset.
    let userSharePct = DEFAULT_USER_SHARE_PERCENT;
    if (pkg.applicationId) {
      const app = await this.appRepo.findOne({ where: { id: pkg.applicationId } });
      if (app && app.userSharePercent > 0) {
        userSharePct = app.userSharePercent;
      }
    }
    const platformFee = Number((price * (PLATFORM_FEE_PERCENT / 100)).toFixed(2));
    const contributorCut = Number((price * (userSharePct / 100)).toFixed(2));
    const sellerCut = Number((price - platformFee - contributorCut).toFixed(2));
    const downloadToken = crypto.randomBytes(24).toString('base64url');

    const purchase = await this.financialTx.runInTransaction(async (qr) => {
      // 1. Seller cut (70%) → developer wallet (available so payouts work right away)
      const { creditId } = await this.financialTx.transferAtomic(qr, {
        sourceWalletId: buyerWallet.id,
        destWalletId: sellerWallet.id,
        amount: sellerCut,
        currency: buyerWallet.currency,
        referenceId: pkg.id,
        type: TransactionType.PACKAGE_SALE,
        target: 'available',
        metadata: {
          side: 'seller_cut',
          package_id: pkg.id,
          buyer_id: buyerId,
        },
      });

      // 2. Platform fee (10%) → platform system wallet
      if (platformFee > 0) {
        await this.financialTx.transferAtomic(qr, {
          sourceWalletId: buyerWallet.id,
          destWalletId: SYSTEM_WALLET_IDS.PLATFORM,
          amount: platformFee,
          currency: buyerWallet.currency,
          referenceId: pkg.id,
          type: TransactionType.FEE,
          target: 'available',
          metadata: {
            side: 'platform_fee',
            package_id: pkg.id,
            buyer_id: buyerId,
          },
        });
      }

      // 3. Contributor pool (20%) → DATA_CONTRIBUTORS holding wallet.
      //    Async listener (ContributorDistributionService) distributes to users after commit.
      if (contributorCut > 0) {
        await this.financialTx.transferAtomic(qr, {
          sourceWalletId: buyerWallet.id,
          destWalletId: SYSTEM_WALLET_IDS.DATA_CONTRIBUTORS,
          amount: contributorCut,
          currency: buyerWallet.currency,
          referenceId: pkg.id,
          type: TransactionType.DATA_REVENUE,
          target: 'available',
          metadata: {
            side: 'contributor_pool',
            package_id: pkg.id,
            buyer_id: buyerId,
          },
        });
      }

      // 3. Purchase row + status bump
      const row = qr.manager.create(PackagePurchase, {
        packageId: pkg.id,
        buyerId,
        amount: price,
        ledgerTransactionId: creditId,
        downloadToken,
        purchasedAt: new Date(),
      });
      const saved = await qr.manager.save(row);

      // First purchase flips the package to 'sold' for badge purposes.
      // We leave it visible in marketplace listings (per spec).
      if (pkg.status === PackageStatus.CERTIFIED) {
        await qr.manager.update(
          DataPackage,
          { id: pkg.id },
          { status: PackageStatus.SOLD },
        );
      }
      return saved;
    });

    this.eventEmitter.emit('package.purchased', {
      packageId: pkg.id,
      purchaseId: purchase.id,
      buyerId,
      developerId: pkg.developerId,
      applicationId: pkg.applicationId,
      category: pkg.category,
      amount: price,
      sellerCut,
      platformFee,
      contributorCut,
    });

    return purchase;
  }

  async getPurchaseForDownload(
    packageId: string,
    buyerId: string,
    token: string,
  ): Promise<{ pkg: DataPackage; purchase: PackagePurchase }> {
    const purchase = await this.purchaseRepo.findOne({
      where: { packageId, buyerId, downloadToken: token },
    });
    if (!purchase) {
      throw new ForbiddenException('No matching purchase / invalid token');
    }
    const pkg = await this.packageRepo.findOne({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    return { pkg, purchase };
  }

  async listMyPurchases(buyerId: string): Promise<
    Array<PackagePurchase & { package: DataPackage | null }>
  > {
    const purchases = await this.purchaseRepo.find({
      where: { buyerId },
      order: { purchasedAt: 'DESC' },
    });
    // Hydrate the joined package row — cheap N+1 for MVP; small N expected.
    const packageMap = new Map<string, DataPackage>();
    if (purchases.length) {
      const pkgs = await this.packageRepo.find({
        where: purchases.map((p) => ({ id: p.packageId })),
      });
      pkgs.forEach((p) => packageMap.set(p.id, p));
    }
    return purchases.map((p) => ({
      ...p,
      package: packageMap.get(p.packageId) ?? null,
    }));
  }

  // ---------------------------------------------------------------------------
  // ADMIN
  // ---------------------------------------------------------------------------

  async listAll(): Promise<DataPackage[]> {
    return this.packageRepo.find({ order: { createdAt: 'DESC' } });
  }

  async delist(id: string): Promise<DataPackage> {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    pkg.status = PackageStatus.DELISTED;
    return this.packageRepo.save(pkg);
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private async findBuyerWallet(buyerId: string): Promise<Wallet | null> {
    // Buyers and end-users both store funds in `wallets.owner_id`. Look up
    // by owner; prefer BUYER-type if multiple exist for the same account.
    const wallets = await this.walletRepo.find({ where: { ownerId: buyerId } });
    if (!wallets.length) return null;
    return (
      wallets.find((w) => w.type === WalletType.BUYER) ??
      wallets.find((w) => w.type === WalletType.USER) ??
      wallets[0]
    );
  }

  private async findDeveloperWallet(developerId: string): Promise<Wallet | null> {
    const wallets = await this.walletRepo.find({ where: { ownerId: developerId } });
    if (!wallets.length) return null;
    return (
      wallets.find((w) => w.type === WalletType.DEVELOPER) ?? wallets[0]
    );
  }

  private assertSampleRowsValid(dto: CreatePackageDto): void {
    // Hard cap: max 200 chars per stringified field. Keeps token budget bounded.
    const MAX_FIELD_CHARS = 200;
    for (const row of dto.sample_rows) {
      for (const [k, v] of Object.entries(row)) {
        const s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
        if (s.length > MAX_FIELD_CHARS) {
          throw new BadRequestException(
            `sample_rows field "${k}" exceeds ${MAX_FIELD_CHARS} characters`,
          );
        }
      }
    }
  }
}
