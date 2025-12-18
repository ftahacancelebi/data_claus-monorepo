package ports

import (
	"context"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
)

type ScoredEventRepository interface {
	Save(ctx context.Context, event *domain.ScoredEvent) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.ScoredEvent, error)
	GetByUserID(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*domain.ScoredEvent, error)
	GetByDeveloperID(ctx context.Context, developerID uuid.UUID, limit, offset int) ([]*domain.ScoredEvent, error)
	GetAll(ctx context.Context, limit, offset int) ([]*domain.ScoredEvent, error)
	GetAverageQualityScore(ctx context.Context, userID uuid.UUID) (float64, error)
}

type AnalyticsService interface {
	GetEvents(ctx context.Context, limit, offset int) ([]*domain.ScoredEvent, error)
	GetEventsByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*domain.ScoredEvent, error)
	GetEventsByDeveloper(ctx context.Context, developerID uuid.UUID, limit, offset int) ([]*domain.ScoredEvent, error)
	GetUserQualityScore(ctx context.Context, userID uuid.UUID) (float64, error)
	GetDashboardStats(ctx context.Context) (*DashboardStats, error)
}

type DashboardStats struct {
	TotalEvents       int64   `json:"total_events"`
	TotalUsers        int64   `json:"total_users"`
	TotalDevelopers   int64   `json:"total_developers"`
	AverageQuality    float64 `json:"average_quality"`
	TotalPayouts      float64 `json:"total_payouts"`
	ActiveCampaigns   int64   `json:"active_campaigns"`
}
