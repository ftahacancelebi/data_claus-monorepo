package ports

import (
	"context"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
)

type WalletRepository interface {
	Save(ctx context.Context, wallet *domain.Wallet) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Wallet, error)
	GetByOwnerID(ctx context.Context, ownerID uuid.UUID) ([]*domain.Wallet, error)
	UpdateBalance(ctx context.Context, id uuid.UUID, amount float64) error
	UpdatePendingBalance(ctx context.Context, id uuid.UUID, amount float64) error
	ReleasePendingBalance(ctx context.Context, id uuid.UUID) error
	GetAll(ctx context.Context) ([]*domain.Wallet, error)
}

type WalletService interface {
	Create(ctx context.Context, ownerID uuid.UUID, walletType, currency string) (*domain.Wallet, error)
	Get(ctx context.Context, id uuid.UUID) (*domain.Wallet, error)
	GetByOwner(ctx context.Context, ownerID uuid.UUID) ([]*domain.Wallet, error)
	Credit(ctx context.Context, id uuid.UUID, amount float64) error
	CreditPending(ctx context.Context, id uuid.UUID, amount float64) error
	Debit(ctx context.Context, id uuid.UUID, amount float64) error
	ReleasePendingIfThreshold(ctx context.Context, id uuid.UUID) (float64, error)
	ProcessPendingReleases(ctx context.Context) (int, error)
}
