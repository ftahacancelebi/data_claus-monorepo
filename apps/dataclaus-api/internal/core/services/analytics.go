package services

import (
	"context"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
)

type AnalyticsService struct {
	eventRepo    ports.ScoredEventRepository
	userRepo     ports.UserRepository
	devRepo      ports.DeveloperRepository
	campaignRepo ports.CampaignRepository
	ledgerRepo   ports.LedgerRepository
}

func NewAnalyticsService(
	eventRepo ports.ScoredEventRepository,
	userRepo ports.UserRepository,
	devRepo ports.DeveloperRepository,
	campaignRepo ports.CampaignRepository,
	ledgerRepo ports.LedgerRepository,
) ports.AnalyticsService {
	return &AnalyticsService{
		eventRepo:    eventRepo,
		userRepo:     userRepo,
		devRepo:      devRepo,
		campaignRepo: campaignRepo,
		ledgerRepo:   ledgerRepo,
	}
}

func (s *AnalyticsService) GetEvents(ctx context.Context, limit, offset int) ([]*domain.ScoredEvent, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.eventRepo.GetAll(ctx, limit, offset)
}

func (s *AnalyticsService) GetEventsByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*domain.ScoredEvent, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.eventRepo.GetByUserID(ctx, userID, limit, offset)
}

func (s *AnalyticsService) GetEventsByDeveloper(ctx context.Context, developerID uuid.UUID, limit, offset int) ([]*domain.ScoredEvent, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.eventRepo.GetByDeveloperID(ctx, developerID, limit, offset)
}

func (s *AnalyticsService) GetUserQualityScore(ctx context.Context, userID uuid.UUID) (float64, error) {
	return s.eventRepo.GetAverageQualityScore(ctx, userID)
}

func (s *AnalyticsService) GetDashboardStats(ctx context.Context) (*ports.DashboardStats, error) {
	events, _ := s.eventRepo.GetAll(ctx, 1000, 0)
	campaigns, _ := s.campaignRepo.GetActive(ctx)
	transactions, _ := s.ledgerRepo.GetAll(ctx, 1000, 0)

	var totalPayouts float64
	var totalQuality float64
	userSet := make(map[uuid.UUID]bool)
	devSet := make(map[uuid.UUID]bool)

	for _, e := range events {
		totalQuality += e.QualityScore
		userSet[e.UserID] = true
		devSet[e.DeveloperID] = true
	}

	for _, tx := range transactions {
		if tx.Type == "payout" {
			totalPayouts += tx.Amount
		}
	}

	avgQuality := 0.0
	if len(events) > 0 {
		avgQuality = totalQuality / float64(len(events))
	}

	return &ports.DashboardStats{
		TotalEvents:     int64(len(events)),
		TotalUsers:      int64(len(userSet)),
		TotalDevelopers: int64(len(devSet)),
		AverageQuality:  avgQuality,
		TotalPayouts:    totalPayouts,
		ActiveCampaigns: int64(len(campaigns)),
	}, nil
}
