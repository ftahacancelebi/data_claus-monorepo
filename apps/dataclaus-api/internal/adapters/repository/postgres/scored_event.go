package postgres

import (
	"context"
	"errors"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ScoredEventRepository struct {
	db *gorm.DB
}

func NewScoredEventRepository(db *gorm.DB) ports.ScoredEventRepository {
	return &ScoredEventRepository{db: db}
}

func (r *ScoredEventRepository) Save(ctx context.Context, event *domain.ScoredEvent) error {
	gormEvent := toScoredEventGorm(event)
	return r.db.WithContext(ctx).Create(gormEvent).Error
}

func (r *ScoredEventRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.ScoredEvent, error) {
	var gormEvent ScoredEventGorm
	if err := r.db.WithContext(ctx).First(&gormEvent, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("scored event not found")
		}
		return nil, err
	}
	return toScoredEventDomain(&gormEvent), nil
}

func (r *ScoredEventRepository) GetByUserID(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*domain.ScoredEvent, error) {
	var gormEvents []ScoredEventGorm
	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&gormEvents).Error; err != nil {
		return nil, err
	}

	events := make([]*domain.ScoredEvent, len(gormEvents))
	for i, ge := range gormEvents {
		events[i] = toScoredEventDomain(&ge)
	}
	return events, nil
}

func (r *ScoredEventRepository) GetByDeveloperID(ctx context.Context, developerID uuid.UUID, limit, offset int) ([]*domain.ScoredEvent, error) {
	var gormEvents []ScoredEventGorm
	if err := r.db.WithContext(ctx).
		Where("developer_id = ?", developerID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&gormEvents).Error; err != nil {
		return nil, err
	}

	events := make([]*domain.ScoredEvent, len(gormEvents))
	for i, ge := range gormEvents {
		events[i] = toScoredEventDomain(&ge)
	}
	return events, nil
}

func (r *ScoredEventRepository) GetAll(ctx context.Context, limit, offset int) ([]*domain.ScoredEvent, error) {
	var gormEvents []ScoredEventGorm
	if err := r.db.WithContext(ctx).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&gormEvents).Error; err != nil {
		return nil, err
	}

	events := make([]*domain.ScoredEvent, len(gormEvents))
	for i, ge := range gormEvents {
		events[i] = toScoredEventDomain(&ge)
	}
	return events, nil
}

func (r *ScoredEventRepository) GetAverageQualityScore(ctx context.Context, userID uuid.UUID) (float64, error) {
	var result struct {
		Avg float64
	}
	if err := r.db.WithContext(ctx).Model(&ScoredEventGorm{}).
		Select("COALESCE(AVG(quality_score), 0) as avg").
		Where("user_id = ?", userID).
		Scan(&result).Error; err != nil {
		return 0, err
	}
	return result.Avg, nil
}

func toScoredEventGorm(e *domain.ScoredEvent) *ScoredEventGorm {
	return &ScoredEventGorm{
		ID:           e.ID,
		EventID:      e.EventID,
		DeveloperID:  e.DeveloperID,
		UserID:       e.UserID,
		QualityScore: e.QualityScore,
		IsHuman:      e.IsHuman,
		Jitter:       e.Jitter,
		TimeVariance: e.TimeVariance,
		CampaignID:   e.CampaignID,
		Payout:       e.Payout,
		ProcessedAt:  e.ProcessedAt,
		CreatedAt:    e.CreatedAt,
	}
}

func toScoredEventDomain(e *ScoredEventGorm) *domain.ScoredEvent {
	return &domain.ScoredEvent{
		ID:           e.ID,
		EventID:      e.EventID,
		DeveloperID:  e.DeveloperID,
		UserID:       e.UserID,
		QualityScore: e.QualityScore,
		IsHuman:      e.IsHuman,
		Jitter:       e.Jitter,
		TimeVariance: e.TimeVariance,
		CampaignID:   e.CampaignID,
		Payout:       e.Payout,
		ProcessedAt:  e.ProcessedAt,
		CreatedAt:    e.CreatedAt,
	}
}
