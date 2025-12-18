package postgres

import (
	"context"
	"errors"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WalletRepository struct {
	db *gorm.DB
}

func NewWalletRepository(db *gorm.DB) ports.WalletRepository {
	return &WalletRepository{db: db}
}

func (r *WalletRepository) Save(ctx context.Context, wallet *domain.Wallet) error {
	gormWallet := toWalletGorm(wallet)
	return r.db.WithContext(ctx).Create(gormWallet).Error
}

func (r *WalletRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Wallet, error) {
	var gormWallet WalletGorm
	if err := r.db.WithContext(ctx).First(&gormWallet, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("wallet not found")
		}
		return nil, err
	}
	return toWalletDomain(&gormWallet), nil
}

func (r *WalletRepository) GetByOwnerID(ctx context.Context, ownerID uuid.UUID) ([]*domain.Wallet, error) {
	var gormWallets []WalletGorm
	if err := r.db.WithContext(ctx).Where("owner_id = ?", ownerID).Find(&gormWallets).Error; err != nil {
		return nil, err
	}

	wallets := make([]*domain.Wallet, len(gormWallets))
	for i, gw := range gormWallets {
		wallets[i] = toWalletDomain(&gw)
	}
	return wallets, nil
}

func (r *WalletRepository) GetAll(ctx context.Context) ([]*domain.Wallet, error) {
	var gormWallets []WalletGorm
	if err := r.db.WithContext(ctx).Find(&gormWallets).Error; err != nil {
		return nil, err
	}

	wallets := make([]*domain.Wallet, len(gormWallets))
	for i, gw := range gormWallets {
		wallets[i] = toWalletDomain(&gw)
	}
	return wallets, nil
}

func (r *WalletRepository) UpdateBalance(ctx context.Context, id uuid.UUID, amount float64) error {
	return r.db.WithContext(ctx).Model(&WalletGorm{}).Where("id = ?", id).
		UpdateColumn("balance", gorm.Expr("balance + ?", amount)).Error
}

func (r *WalletRepository) UpdatePendingBalance(ctx context.Context, id uuid.UUID, amount float64) error {
	return r.db.WithContext(ctx).Model(&WalletGorm{}).Where("id = ?", id).
		UpdateColumn("pending_balance", gorm.Expr("pending_balance + ?", amount)).Error
}

func (r *WalletRepository) ReleasePendingBalance(ctx context.Context, id uuid.UUID) error {
	// Atomically move pending to balance if >= threshold
	return r.db.WithContext(ctx).Model(&WalletGorm{}).Where("id = ? AND pending_balance >= ?", id, domain.MinPayoutThreshold).
		Updates(map[string]interface{}{
			"balance":         gorm.Expr("balance + pending_balance"),
			"pending_balance": 0,
		}).Error
}

func toWalletGorm(w *domain.Wallet) *WalletGorm {
	return &WalletGorm{
		ID:             w.ID,
		OwnerID:        w.OwnerID,
		Type:           w.Type,
		Balance:        w.Balance,
		PendingBalance: w.PendingBalance,
		Currency:       w.Currency,
		CreatedAt:      w.CreatedAt,
		UpdatedAt:      w.UpdatedAt,
	}
}

func toWalletDomain(w *WalletGorm) *domain.Wallet {
	return &domain.Wallet{
		ID:             w.ID,
		OwnerID:        w.OwnerID,
		Type:           w.Type,
		Balance:        w.Balance,
		PendingBalance: w.PendingBalance,
		Currency:       w.Currency,
		CreatedAt:      w.CreatedAt,
		UpdatedAt:      w.UpdatedAt,
	}
}
