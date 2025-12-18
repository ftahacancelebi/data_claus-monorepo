package services

import (
	"context"
	"errors"
	"testing"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockDeveloperRepository struct {
	mock.Mock
}

func (m *MockDeveloperRepository) Save(ctx context.Context, developer *domain.Developer) error {
	args := m.Called(ctx, developer)
	return args.Error(0)
}

func (m *MockDeveloperRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Developer, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Developer), args.Error(1)
}

func (m *MockDeveloperRepository) GetByEmail(ctx context.Context, email string) (*domain.Developer, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Developer), args.Error(1)
}

func (m *MockDeveloperRepository) Update(ctx context.Context, developer *domain.Developer) error {
	args := m.Called(ctx, developer)
	return args.Error(0)
}

type MockAPIKeyRepository struct {
	mock.Mock
}

func (m *MockAPIKeyRepository) Save(ctx context.Context, apiKey *domain.APIKey) error {
	args := m.Called(ctx, apiKey)
	return args.Error(0)
}

func (m *MockAPIKeyRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.APIKey, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.APIKey), args.Error(1)
}

func (m *MockAPIKeyRepository) GetByKeyHash(ctx context.Context, keyHash string) (*domain.APIKey, error) {
	args := m.Called(ctx, keyHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.APIKey), args.Error(1)
}

func (m *MockAPIKeyRepository) GetByDeveloperID(ctx context.Context, developerID uuid.UUID) ([]*domain.APIKey, error) {
	args := m.Called(ctx, developerID)
	return args.Get(0).([]*domain.APIKey), args.Error(1)
}

func (m *MockAPIKeyRepository) Deactivate(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockAPIKeyRepository) UpdateLastUsed(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func TestDeveloperService_Register(t *testing.T) {
	repo := new(MockDeveloperRepository)
	service := NewDeveloperService(repo)
	ctx := context.Background()

	repo.On("GetByEmail", ctx, "test@example.com").Return(nil, errors.New("not found"))
	repo.On("Save", ctx, mock.AnythingOfType("*domain.Developer")).Return(nil)

	dev, err := service.Register(ctx, "Test Dev", "test@example.com", "Password123!")

	assert.NoError(t, err)
	assert.NotNil(t, dev)
	assert.Equal(t, "Test Dev", dev.Name)
	assert.Equal(t, "test@example.com", dev.Email)
	repo.AssertExpectations(t)
}

func TestDeveloperService_Register_EmailExists(t *testing.T) {
	repo := new(MockDeveloperRepository)
	service := NewDeveloperService(repo)
	ctx := context.Background()

	existingDev := &domain.Developer{Email: "test@example.com"}
	repo.On("GetByEmail", ctx, "test@example.com").Return(existingDev, nil)

	dev, err := service.Register(ctx, "Test Dev", "test@example.com", "Password123!")

	assert.Error(t, err)
	assert.Nil(t, dev)
	assert.Equal(t, "developer with this email already exists", err.Error())
}

func TestAPIKeyService_Generate(t *testing.T) {
	devRepo := new(MockDeveloperRepository)
	keyRepo := new(MockAPIKeyRepository)
	service := NewAPIKeyService(keyRepo, devRepo)
	ctx := context.Background()
	devID := uuid.New()

	dev := &domain.Developer{ID: devID}
	devRepo.On("GetByID", ctx, devID).Return(dev, nil)
	keyRepo.On("Save", ctx, mock.AnythingOfType("*domain.APIKey")).Return(nil)

	apiKey, rawKey, err := service.Generate(ctx, devID, "Test Key")

	assert.NoError(t, err)
	assert.NotNil(t, apiKey)
	assert.NotEmpty(t, rawKey)
	assert.Equal(t, "Test Key", apiKey.Name)
	assert.True(t, apiKey.IsActive)
	devRepo.AssertExpectations(t)
	keyRepo.AssertExpectations(t)
}

func TestAPIKeyService_ValidateKey(t *testing.T) {
	devRepo := new(MockDeveloperRepository)
	keyRepo := new(MockAPIKeyRepository)
	service := NewAPIKeyService(keyRepo, devRepo)
	ctx := context.Background()
	keyID := uuid.New()

	apiKey := &domain.APIKey{ID: keyID, IsActive: true}
	keyRepo.On("GetByKeyHash", ctx, "test-key").Return(apiKey, nil)
	keyRepo.On("UpdateLastUsed", ctx, keyID).Return(nil)

	result, err := service.ValidateKey(ctx, "test-key")

	assert.NoError(t, err)
	assert.NotNil(t, result)
	keyRepo.AssertExpectations(t)
}

func TestAPIKeyService_ValidateKey_Inactive(t *testing.T) {
	devRepo := new(MockDeveloperRepository)
	keyRepo := new(MockAPIKeyRepository)
	service := NewAPIKeyService(keyRepo, devRepo)
	ctx := context.Background()

	apiKey := &domain.APIKey{IsActive: false}
	keyRepo.On("GetByKeyHash", ctx, "test-key").Return(apiKey, nil)

	result, err := service.ValidateKey(ctx, "test-key")

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, "API key is deactivated", err.Error())
}
