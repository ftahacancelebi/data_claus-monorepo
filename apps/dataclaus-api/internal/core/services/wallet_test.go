package services

import (
	"context"
	"testing"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockWalletRepository struct {
	mock.Mock
}

func (m *MockWalletRepository) Save(ctx context.Context, wallet *domain.Wallet) error {
	args := m.Called(ctx, wallet)
	return args.Error(0)
}

func (m *MockWalletRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Wallet, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Wallet), args.Error(1)
}

func (m *MockWalletRepository) GetByOwnerID(ctx context.Context, ownerID uuid.UUID) ([]*domain.Wallet, error) {
	args := m.Called(ctx, ownerID)
	return args.Get(0).([]*domain.Wallet), args.Error(1)
}

func (m *MockWalletRepository) UpdateBalance(ctx context.Context, id uuid.UUID, amount float64) error {
	args := m.Called(ctx, id, amount)
	return args.Error(0)
}

func (m *MockWalletRepository) UpdatePendingBalance(ctx context.Context, id uuid.UUID, amount float64) error {
	args := m.Called(ctx, id, amount)
	return args.Error(0)
}

func (m *MockWalletRepository) ReleasePendingBalance(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockWalletRepository) GetAll(ctx context.Context) ([]*domain.Wallet, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Wallet), args.Error(1)
}

func TestWalletService_Create(t *testing.T) {
	repo := new(MockWalletRepository)
	service := NewWalletService(repo)
	ctx := context.Background()
	ownerID := uuid.New()

	repo.On("Save", ctx, mock.AnythingOfType("*domain.Wallet")).Return(nil)

	wallet, err := service.Create(ctx, ownerID, "user", "USD")

	assert.NoError(t, err)
	assert.NotNil(t, wallet)
	assert.Equal(t, ownerID, wallet.OwnerID)
	assert.Equal(t, "user", wallet.Type)
	assert.Equal(t, "USD", wallet.Currency)
	assert.Equal(t, float64(0), wallet.Balance)
	assert.Equal(t, float64(0), wallet.PendingBalance)
	repo.AssertExpectations(t)
}

func TestWalletService_Create_InvalidType(t *testing.T) {
	repo := new(MockWalletRepository)
	service := NewWalletService(repo)
	ctx := context.Background()
	ownerID := uuid.New()

	wallet, err := service.Create(ctx, ownerID, "invalid", "USD")

	assert.Error(t, err)
	assert.Nil(t, wallet)
	assert.Equal(t, "invalid wallet type", err.Error())
}

func TestWalletService_Credit(t *testing.T) {
	repo := new(MockWalletRepository)
	service := NewWalletService(repo)
	ctx := context.Background()
	walletID := uuid.New()

	repo.On("UpdateBalance", ctx, walletID, float64(100)).Return(nil)

	err := service.Credit(ctx, walletID, 100)

	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestWalletService_CreditPending(t *testing.T) {
	repo := new(MockWalletRepository)
	service := NewWalletService(repo)
	ctx := context.Background()
	walletID := uuid.New()

	repo.On("UpdatePendingBalance", ctx, walletID, float64(0.005)).Return(nil)

	err := service.CreditPending(ctx, walletID, 0.005)

	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestWalletService_Debit_InsufficientBalance(t *testing.T) {
	repo := new(MockWalletRepository)
	service := NewWalletService(repo)
	ctx := context.Background()
	walletID := uuid.New()

	wallet := &domain.Wallet{ID: walletID, Balance: 50}
	repo.On("GetByID", ctx, walletID).Return(wallet, nil)

	err := service.Debit(ctx, walletID, 100)

	assert.Error(t, err)
	assert.Equal(t, "insufficient balance", err.Error())
}

func TestWalletService_Debit_Success(t *testing.T) {
	repo := new(MockWalletRepository)
	service := NewWalletService(repo)
	ctx := context.Background()
	walletID := uuid.New()

	wallet := &domain.Wallet{ID: walletID, Balance: 200}
	repo.On("GetByID", ctx, walletID).Return(wallet, nil)
	repo.On("UpdateBalance", ctx, walletID, float64(-100)).Return(nil)

	err := service.Debit(ctx, walletID, 100)

	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestWalletService_ReleasePendingIfThreshold(t *testing.T) {
	repo := new(MockWalletRepository)
	service := NewWalletService(repo)
	ctx := context.Background()
	walletID := uuid.New()

	wallet := &domain.Wallet{ID: walletID, Balance: 0, PendingBalance: 0.02}
	repo.On("GetByID", ctx, walletID).Return(wallet, nil)
	repo.On("ReleasePendingBalance", ctx, walletID).Return(nil)

	released, err := service.ReleasePendingIfThreshold(ctx, walletID)

	assert.NoError(t, err)
	assert.Equal(t, 0.02, released)
	repo.AssertExpectations(t)
}

func TestWalletService_ReleasePendingIfThreshold_BelowThreshold(t *testing.T) {
	repo := new(MockWalletRepository)
	service := NewWalletService(repo)
	ctx := context.Background()
	walletID := uuid.New()

	wallet := &domain.Wallet{ID: walletID, Balance: 0, PendingBalance: 0.005}
	repo.On("GetByID", ctx, walletID).Return(wallet, nil)

	released, err := service.ReleasePendingIfThreshold(ctx, walletID)

	assert.NoError(t, err)
	assert.Equal(t, float64(0), released)
}
