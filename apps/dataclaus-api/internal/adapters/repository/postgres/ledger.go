package postgres

import (
	"context"
	"errors"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LedgerRepository struct {
	db *gorm.DB
}

func NewLedgerRepository(db *gorm.DB) ports.LedgerRepository {
	return &LedgerRepository{db: db}
}

func (r *LedgerRepository) Save(ctx context.Context, tx *domain.LedgerTransaction) error {
	gormTx := toLedgerGorm(tx)
	return r.db.WithContext(ctx).Create(gormTx).Error
}

func (r *LedgerRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.LedgerTransaction, error) {
	var gormTx LedgerTransactionGorm
	if err := r.db.WithContext(ctx).First(&gormTx, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("transaction not found")
		}
		return nil, err
	}
	return toLedgerDomain(&gormTx), nil
}

func (r *LedgerRepository) GetByWalletID(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]*domain.LedgerTransaction, error) {
	var gormTxs []LedgerTransactionGorm
	if err := r.db.WithContext(ctx).
		Where("source_wallet_id = ? OR dest_wallet_id = ?", walletID, walletID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&gormTxs).Error; err != nil {
		return nil, err
	}

	txs := make([]*domain.LedgerTransaction, len(gormTxs))
	for i, gt := range gormTxs {
		txs[i] = toLedgerDomain(&gt)
	}
	return txs, nil
}

func (r *LedgerRepository) GetAll(ctx context.Context, limit, offset int) ([]*domain.LedgerTransaction, error) {
	var gormTxs []LedgerTransactionGorm
	if err := r.db.WithContext(ctx).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&gormTxs).Error; err != nil {
		return nil, err
	}

	txs := make([]*domain.LedgerTransaction, len(gormTxs))
	for i, gt := range gormTxs {
		txs[i] = toLedgerDomain(&gt)
	}
	return txs, nil
}

func toLedgerGorm(t *domain.LedgerTransaction) *LedgerTransactionGorm {
	return &LedgerTransactionGorm{
		ID:             t.ID,
		SourceWalletID: t.SourceWalletID,
		DestWalletID:   t.DestWalletID,
		Amount:         t.Amount,
		Currency:       t.Currency,
		ReferenceID:    t.ReferenceID,
		Type:           t.Type,
		Status:         t.Status,
		CreatedAt:      t.CreatedAt,
	}
}

func toLedgerDomain(t *LedgerTransactionGorm) *domain.LedgerTransaction {
	return &domain.LedgerTransaction{
		ID:             t.ID,
		SourceWalletID: t.SourceWalletID,
		DestWalletID:   t.DestWalletID,
		Amount:         t.Amount,
		Currency:       t.Currency,
		ReferenceID:    t.ReferenceID,
		Type:           t.Type,
		Status:         t.Status,
		CreatedAt:      t.CreatedAt,
	}
}
