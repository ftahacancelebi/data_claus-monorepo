package services

import (
	"context"
	"errors"
	"time"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
)

type CampaignService struct {
	repo ports.CampaignRepository
}

func NewCampaignService(repo ports.CampaignRepository) ports.CampaignService {
	return &CampaignService{repo: repo}
}

func (s *CampaignService) Create(ctx context.Context, buyerID uuid.UUID, name string, budget float64) (*domain.Campaign, error) {
	if budget <= 0 {
		return nil, errors.New("budget must be positive")
	}

	now := time.Now().UTC()
	campaign := &domain.Campaign{
		ID:          uuid.New(),
		BuyerID:     buyerID,
		Name:        name,
		TotalBudget: budget,
		Remaining:   budget,
		Status:      "active",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Save(ctx, campaign); err != nil {
		return nil, err
	}

	return campaign, nil
}

func (s *CampaignService) Get(ctx context.Context, id uuid.UUID) (*domain.Campaign, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *CampaignService) GetActive(ctx context.Context) ([]*domain.Campaign, error) {
	return s.repo.GetActive(ctx)
}

func (s *CampaignService) GetByBuyer(ctx context.Context, buyerID uuid.UUID) ([]*domain.Campaign, error) {
	return s.repo.GetByBuyerID(ctx, buyerID)
}

func (s *CampaignService) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	validStatuses := map[string]bool{"active": true, "paused": true, "completed": true}
	if !validStatuses[status] {
		return errors.New("invalid status")
	}

	campaign, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	campaign.Status = status
	campaign.UpdatedAt = time.Now().UTC()

	return s.repo.Update(ctx, campaign)
}

func (s *CampaignService) DeductBudget(ctx context.Context, id uuid.UUID, amount float64) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}

	campaign, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if campaign.Remaining < amount {
		return errors.New("insufficient campaign budget")
	}

	return s.repo.DeductBudget(ctx, id, amount)
}
