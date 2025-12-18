package services

import (
	"context"
	"testing"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockLedgerRepository struct {
	mock.Mock
}

func (m *MockLedgerRepository) Save(ctx context.Context, tx *domain.LedgerTransaction) error {
	args := m.Called(ctx, tx)
	return args.Error(0)
}

func (m *MockLedgerRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.LedgerTransaction, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.LedgerTransaction), args.Error(1)
}

func (m *MockLedgerRepository) GetByWalletID(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]*domain.LedgerTransaction, error) {
	args := m.Called(ctx, walletID, limit, offset)
	return args.Get(0).([]*domain.LedgerTransaction), args.Error(1)
}

func (m *MockLedgerRepository) GetAll(ctx context.Context, limit, offset int) ([]*domain.LedgerTransaction, error) {
	args := m.Called(ctx, limit, offset)
	return args.Get(0).([]*domain.LedgerTransaction), args.Error(1)
}

func TestLedgerService_Create(t *testing.T) {
	repo := new(MockLedgerRepository)
	service := NewLedgerService(repo)
	ctx := context.Background()
	sourceID := uuid.New()
	destID := uuid.New()
	refID := uuid.New()

	repo.On("Save", ctx, mock.AnythingOfType("*domain.LedgerTransaction")).Return(nil)

	tx, err := service.Create(ctx, sourceID, destID, 100, "USD", refID, "payout")

	assert.NoError(t, err)
	assert.NotNil(t, tx)
	assert.Equal(t, sourceID, tx.SourceWalletID)
	assert.Equal(t, destID, tx.DestWalletID)
	assert.Equal(t, float64(100), tx.Amount)
	assert.Equal(t, "USD", tx.Currency)
	assert.Equal(t, "payout", tx.Type)
	assert.Equal(t, "completed", tx.Status)
	repo.AssertExpectations(t)
}

func TestLedgerService_Create_InvalidAmount(t *testing.T) {
	repo := new(MockLedgerRepository)
	service := NewLedgerService(repo)
	ctx := context.Background()
	sourceID := uuid.New()
	destID := uuid.New()
	refID := uuid.New()

	tx, err := service.Create(ctx, sourceID, destID, 0, "USD", refID, "payout")

	assert.Error(t, err)
	assert.Nil(t, tx)
	assert.Equal(t, "amount must be positive", err.Error())
}

func TestLedgerService_Create_InvalidType(t *testing.T) {
	repo := new(MockLedgerRepository)
	service := NewLedgerService(repo)
	ctx := context.Background()
	sourceID := uuid.New()
	destID := uuid.New()
	refID := uuid.New()

	tx, err := service.Create(ctx, sourceID, destID, 100, "USD", refID, "invalid")

	assert.Error(t, err)
	assert.Nil(t, tx)
	assert.Equal(t, "invalid transaction type", err.Error())
}

func TestLedgerService_GetAll(t *testing.T) {
	repo := new(MockLedgerRepository)
	service := NewLedgerService(repo)
	ctx := context.Background()

	txs := []*domain.LedgerTransaction{{ID: uuid.New()}, {ID: uuid.New()}}
	repo.On("GetAll", ctx, 20, 0).Return(txs, nil)

	result, err := service.GetAll(ctx, 0, 0)

	assert.NoError(t, err)
	assert.Len(t, result, 2)
	repo.AssertExpectations(t)
}
