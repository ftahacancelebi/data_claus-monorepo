package services

import (
	"context"
	"errors"
	"time"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
)

type LedgerService struct {
	repo ports.LedgerRepository
}

func NewLedgerService(repo ports.LedgerRepository) ports.LedgerService {
	return &LedgerService{repo: repo}
}

func (s *LedgerService) Create(ctx context.Context, sourceWalletID, destWalletID uuid.UUID, amount float64, currency string, referenceID uuid.UUID, txType string) (*domain.LedgerTransaction, error) {
	if amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	validTypes := map[string]bool{"payout": true, "deposit": true, "fee": true}
	if !validTypes[txType] {
		return nil, errors.New("invalid transaction type")
	}

	tx := &domain.LedgerTransaction{
		ID:             uuid.New(),
		SourceWalletID: sourceWalletID,
		DestWalletID:   destWalletID,
		Amount:         amount,
		Currency:       currency,
		ReferenceID:    referenceID,
		Type:           txType,
		Status:         "completed",
		CreatedAt:      time.Now().UTC(),
	}

	if err := s.repo.Save(ctx, tx); err != nil {
		return nil, err
	}

	return tx, nil
}

func (s *LedgerService) Get(ctx context.Context, id uuid.UUID) (*domain.LedgerTransaction, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *LedgerService) GetByWallet(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]*domain.LedgerTransaction, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.GetByWalletID(ctx, walletID, limit, offset)
}

func (s *LedgerService) GetAll(ctx context.Context, limit, offset int) ([]*domain.LedgerTransaction, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.GetAll(ctx, limit, offset)
}
