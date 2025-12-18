package ports

import (
	"context"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
)

type LedgerRepository interface {
	Save(ctx context.Context, tx *domain.LedgerTransaction) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.LedgerTransaction, error)
	GetByWalletID(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]*domain.LedgerTransaction, error)
	GetAll(ctx context.Context, limit, offset int) ([]*domain.LedgerTransaction, error)
}

type LedgerService interface {
	Create(ctx context.Context, sourceWalletID, destWalletID uuid.UUID, amount float64, currency string, referenceID uuid.UUID, txType string) (*domain.LedgerTransaction, error)
	Get(ctx context.Context, id uuid.UUID) (*domain.LedgerTransaction, error)
	GetByWallet(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]*domain.LedgerTransaction, error)
	GetAll(ctx context.Context, limit, offset int) ([]*domain.LedgerTransaction, error)
}
