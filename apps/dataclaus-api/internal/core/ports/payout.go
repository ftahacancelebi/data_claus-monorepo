package ports

import (
	"context"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
)

type PayoutService interface {
	// ProcessEventPayout calculates and distributes payout for a scored event
	ProcessEventPayout(ctx context.Context, event *domain.ScoredEvent, campaignID uuid.UUID) (*domain.PayoutCalculation, error)
	
	// ProcessSessionPayout calculates and distributes payout for a completed session
	ProcessSessionPayout(ctx context.Context, session *domain.UserSession) (*domain.PayoutCalculation, error)
	
	// GetCampaignRatePerHour returns the hourly rate for a campaign based on remaining budget
	GetCampaignRatePerHour(ctx context.Context, campaignID uuid.UUID) (float64, error)
}

type UserSessionRepository interface {
	Save(ctx context.Context, session *domain.UserSession) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.UserSession, error)
	GetActiveByUserID(ctx context.Context, userID uuid.UUID) (*domain.UserSession, error)
	GetByUserID(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*domain.UserSession, error)
	Update(ctx context.Context, session *domain.UserSession) error
	EndSession(ctx context.Context, id uuid.UUID, activeSeconds int64, qualityScore float64) error
}
