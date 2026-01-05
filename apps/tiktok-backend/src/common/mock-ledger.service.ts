/**
 * Mock Ledger Service
 *
 * Shared in-memory ledger for demo purposes.
 * In production, this would be replaced by calls to the Go API.
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class MockLedgerService {
  private ledger = new Map<string, number>();

  /**
   * Add earnings to a user's balance
   */
  addEarnings(userId: string, amount: number): number {
    const current = this.ledger.get(userId) || 0;
    const newTotal = current + amount;
    this.ledger.set(userId, newTotal);
    return newTotal;
  }

  /**
   * Get a user's total earnings
   */
  getTotal(userId: string): number {
    return this.ledger.get(userId) || 0;
  }

  /**
   * Get all earnings (for debugging)
   */
  getAllEarnings(): { userId: string; total: number }[] {
    const result: { userId: string; total: number }[] = [];
    this.ledger.forEach((total, userId) => {
      result.push({ userId, total });
    });
    return result;
  }
}
