package services

import (
	"context"
	"testing"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockCampaignRepository struct {
	mock.Mock
}

func (m *MockCampaignRepository) Save(ctx context.Context, campaign *domain.Campaign) error {
	args := m.Called(ctx, campaign)
	return args.Error(0)
}

func (m *MockCampaignRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Campaign, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Campaign), args.Error(1)
}

func (m *MockCampaignRepository) GetActive(ctx context.Context) ([]*domain.Campaign, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*domain.Campaign), args.Error(1)
}

func (m *MockCampaignRepository) GetByBuyerID(ctx context.Context, buyerID uuid.UUID) ([]*domain.Campaign, error) {
	args := m.Called(ctx, buyerID)
	return args.Get(0).([]*domain.Campaign), args.Error(1)
}

func (m *MockCampaignRepository) Update(ctx context.Context, campaign *domain.Campaign) error {
	args := m.Called(ctx, campaign)
	return args.Error(0)
}

func (m *MockCampaignRepository) DeductBudget(ctx context.Context, id uuid.UUID, amount float64) error {
	args := m.Called(ctx, id, amount)
	return args.Error(0)
}

func TestCampaignService_Create(t *testing.T) {
	repo := new(MockCampaignRepository)
	service := NewCampaignService(repo)
	ctx := context.Background()
	buyerID := uuid.New()

	repo.On("Save", ctx, mock.AnythingOfType("*domain.Campaign")).Return(nil)

	campaign, err := service.Create(ctx, buyerID, "Test Campaign", 1000)

	assert.NoError(t, err)
	assert.NotNil(t, campaign)
	assert.Equal(t, buyerID, campaign.BuyerID)
	assert.Equal(t, "Test Campaign", campaign.Name)
	assert.Equal(t, float64(1000), campaign.TotalBudget)
	assert.Equal(t, float64(1000), campaign.Remaining)
	assert.Equal(t, "active", campaign.Status)
	repo.AssertExpectations(t)
}

func TestCampaignService_Create_InvalidBudget(t *testing.T) {
	repo := new(MockCampaignRepository)
	service := NewCampaignService(repo)
	ctx := context.Background()
	buyerID := uuid.New()

	campaign, err := service.Create(ctx, buyerID, "Test Campaign", 0)

	assert.Error(t, err)
	assert.Nil(t, campaign)
	assert.Equal(t, "budget must be positive", err.Error())
}

func TestCampaignService_UpdateStatus(t *testing.T) {
	repo := new(MockCampaignRepository)
	service := NewCampaignService(repo)
	ctx := context.Background()
	campaignID := uuid.New()

	campaign := &domain.Campaign{ID: campaignID, Status: "active"}
	repo.On("GetByID", ctx, campaignID).Return(campaign, nil)
	repo.On("Update", ctx, mock.AnythingOfType("*domain.Campaign")).Return(nil)

	err := service.UpdateStatus(ctx, campaignID, "paused")

	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestCampaignService_UpdateStatus_InvalidStatus(t *testing.T) {
	repo := new(MockCampaignRepository)
	service := NewCampaignService(repo)
	ctx := context.Background()
	campaignID := uuid.New()

	err := service.UpdateStatus(ctx, campaignID, "invalid")

	assert.Error(t, err)
	assert.Equal(t, "invalid status", err.Error())
}

func TestCampaignService_DeductBudget_InsufficientBudget(t *testing.T) {
	repo := new(MockCampaignRepository)
	service := NewCampaignService(repo)
	ctx := context.Background()
	campaignID := uuid.New()

	campaign := &domain.Campaign{ID: campaignID, Remaining: 50}
	repo.On("GetByID", ctx, campaignID).Return(campaign, nil)

	err := service.DeductBudget(ctx, campaignID, 100)

	assert.Error(t, err)
	assert.Equal(t, "insufficient campaign budget", err.Error())
}
