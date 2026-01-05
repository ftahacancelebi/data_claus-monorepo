import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerTransaction } from './entities/ledger-transaction.entity';
import { LedgerTransactionResponseDto } from './dto';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerTransaction)
    private readonly ledgerRepository: Repository<LedgerTransaction>,
  ) {}

  async findAll(): Promise<LedgerTransactionResponseDto[]> {
    const transactions = await this.ledgerRepository.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return transactions.map((t) => this.toResponseDto(t));
  }

  async findById(id: string): Promise<LedgerTransactionResponseDto> {
    const transaction = await this.ledgerRepository.findOne({ where: { id } });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return this.toResponseDto(transaction);
  }

  async findByWallet(
    walletId: string,
  ): Promise<LedgerTransactionResponseDto[]> {
    const transactions = await this.ledgerRepository.find({
      where: [{ sourceWalletId: walletId }, { destWalletId: walletId }],
      order: { createdAt: 'DESC' },
    });
    return transactions.map((t) => this.toResponseDto(t));
  }

  async recordTransaction(
    dto: Partial<LedgerTransaction>,
  ): Promise<LedgerTransaction> {
    const transaction = this.ledgerRepository.create(dto);
    return this.ledgerRepository.save(transaction);
  }

  private toResponseDto(
    transaction: LedgerTransaction,
  ): LedgerTransactionResponseDto {
    return {
      id: transaction.id,
      source_wallet_id: transaction.sourceWalletId,
      dest_wallet_id: transaction.destWalletId,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      reference_id: transaction.referenceId || undefined,
      type: transaction.type,
      status: transaction.status,
      created_at: transaction.createdAt,
    };
  }
}
