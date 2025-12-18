package services

import (
	"context"
	"errors"
	"time"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
)

type WalletService struct {
	repo ports.WalletRepository
}

func NewWalletService(repo ports.WalletRepository) ports.WalletService {
	return &WalletService{repo: repo}
}

func (s *WalletService) Create(ctx context.Context, ownerID uuid.UUID, walletType, currency string) (*domain.Wallet, error) {
	validTypes := map[string]bool{"user": true, "developer": true, "buyer": true, "faucet": true, "platform": true}
	if !validTypes[walletType] {
		return nil, errors.New("invalid wallet type")
	}

	now := time.Now().UTC()
	wallet := &domain.Wallet{
		ID:             uuid.New(),
		OwnerID:        ownerID,
		Type:           walletType,
		Balance:        0,
		PendingBalance: 0,
		Currency:       currency,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.repo.Save(ctx, wallet); err != nil {
		return nil, err
	}

	return wallet, nil
}

func (s *WalletService) Get(ctx context.Context, id uuid.UUID) (*domain.Wallet, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *WalletService) GetByOwner(ctx context.Context, ownerID uuid.UUID) ([]*domain.Wallet, error) {
	return s.repo.GetByOwnerID(ctx, ownerID)
}

func (s *WalletService) Credit(ctx context.Context, id uuid.UUID, amount float64) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}
	return s.repo.UpdateBalance(ctx, id, amount)
}

// CreditPending adds amount to pending balance (for micro-payments)
func (s *WalletService) CreditPending(ctx context.Context, id uuid.UUID, amount float64) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}
	return s.repo.UpdatePendingBalance(ctx, id, amount)
}

func (s *WalletService) Debit(ctx context.Context, id uuid.UUID, amount float64) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}

	wallet, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if wallet.Balance < amount {
		return errors.New("insufficient balance")
	}

	return s.repo.UpdateBalance(ctx, id, -amount)
}

// ReleasePendingIfThreshold releases pending balance to available if >= threshold
func (s *WalletService) ReleasePendingIfThreshold(ctx context.Context, id uuid.UUID) (float64, error) {
	wallet, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return 0, err
	}

	if wallet.PendingBalance >= domain.MinPayoutThreshold {
		amount := wallet.PendingBalance
		if err := s.repo.ReleasePendingBalance(ctx, id); err != nil {
			return 0, err
		}
		return amount, nil
	}

	return 0, nil
}

// ProcessPendingReleases checks all wallets and releases pending balances that meet threshold
func (s *WalletService) ProcessPendingReleases(ctx context.Context) (int, error) {
	wallets, err := s.repo.GetAll(ctx)
	if err != nil {
		return 0, err
	}

	released := 0
	for _, wallet := range wallets {
		if wallet.PendingBalance >= domain.MinPayoutThreshold {
			if err := s.repo.ReleasePendingBalance(ctx, wallet.ID); err == nil {
				released++
			}
		}
	}

	return released, nil
}
