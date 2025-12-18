package postgres

import (
	"context"
	"errors"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CampaignRepository struct {
	db *gorm.DB
}

func NewCampaignRepository(db *gorm.DB) ports.CampaignRepository {
	return &CampaignRepository{db: db}
}

func (r *CampaignRepository) Save(ctx context.Context, campaign *domain.Campaign) error {
	gormCampaign := toCampaignGorm(campaign)
	return r.db.WithContext(ctx).Create(gormCampaign).Error
}

func (r *CampaignRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Campaign, error) {
	var gormCampaign CampaignGorm
	if err := r.db.WithContext(ctx).First(&gormCampaign, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("campaign not found")
		}
		return nil, err
	}
	return toCampaignDomain(&gormCampaign), nil
}

func (r *CampaignRepository) GetActive(ctx context.Context) ([]*domain.Campaign, error) {
	var gormCampaigns []CampaignGorm
	if err := r.db.WithContext(ctx).Where("status = ?", "active").Find(&gormCampaigns).Error; err != nil {
		return nil, err
	}

	campaigns := make([]*domain.Campaign, len(gormCampaigns))
	for i, gc := range gormCampaigns {
		campaigns[i] = toCampaignDomain(&gc)
	}
	return campaigns, nil
}

func (r *CampaignRepository) GetByBuyerID(ctx context.Context, buyerID uuid.UUID) ([]*domain.Campaign, error) {
	var gormCampaigns []CampaignGorm
	if err := r.db.WithContext(ctx).Where("buyer_id = ?", buyerID).Find(&gormCampaigns).Error; err != nil {
		return nil, err
	}

	campaigns := make([]*domain.Campaign, len(gormCampaigns))
	for i, gc := range gormCampaigns {
		campaigns[i] = toCampaignDomain(&gc)
	}
	return campaigns, nil
}

func (r *CampaignRepository) Update(ctx context.Context, campaign *domain.Campaign) error {
	gormCampaign := toCampaignGorm(campaign)
	return r.db.WithContext(ctx).Save(gormCampaign).Error
}

func (r *CampaignRepository) DeductBudget(ctx context.Context, id uuid.UUID, amount float64) error {
	return r.db.WithContext(ctx).Model(&CampaignGorm{}).Where("id = ?", id).
		UpdateColumn("remaining", gorm.Expr("remaining - ?", amount)).Error
}

func toCampaignGorm(c *domain.Campaign) *CampaignGorm {
	return &CampaignGorm{
		ID:          c.ID,
		BuyerID:     c.BuyerID,
		Name:        c.Name,
		TotalBudget: c.TotalBudget,
		Remaining:   c.Remaining,
		Status:      c.Status,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}

func toCampaignDomain(c *CampaignGorm) *domain.Campaign {
	return &domain.Campaign{
		ID:          c.ID,
		BuyerID:     c.BuyerID,
		Name:        c.Name,
		TotalBudget: c.TotalBudget,
		Remaining:   c.Remaining,
		Status:      c.Status,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}
