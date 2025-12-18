package ports

import (
	"context"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
)

type CampaignRepository interface {
	Save(ctx context.Context, campaign *domain.Campaign) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Campaign, error)
	GetActive(ctx context.Context) ([]*domain.Campaign, error)
	GetByBuyerID(ctx context.Context, buyerID uuid.UUID) ([]*domain.Campaign, error)
	Update(ctx context.Context, campaign *domain.Campaign) error
	DeductBudget(ctx context.Context, id uuid.UUID, amount float64) error
}

type CampaignService interface {
	Create(ctx context.Context, buyerID uuid.UUID, name string, budget float64) (*domain.Campaign, error)
	Get(ctx context.Context, id uuid.UUID) (*domain.Campaign, error)
	GetActive(ctx context.Context) ([]*domain.Campaign, error)
	GetByBuyer(ctx context.Context, buyerID uuid.UUID) ([]*domain.Campaign, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status string) error
	DeductBudget(ctx context.Context, id uuid.UUID, amount float64) error
}
