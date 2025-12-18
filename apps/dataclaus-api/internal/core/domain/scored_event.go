package domain

import (
	"time"

	"github.com/google/uuid"
)

type ScoredEvent struct {
	ID           uuid.UUID
	EventID      string
	DeveloperID  uuid.UUID
	UserID       uuid.UUID
	QualityScore float64
	IsHuman      bool
	Jitter       float64
	TimeVariance float64
	CampaignID   *uuid.UUID
	Payout       float64
	ProcessedAt  time.Time
	CreatedAt    time.Time
}

func NewScoredEvent(eventID string, developerID, userID uuid.UUID, qualityScore float64, isHuman bool, jitter, timeVariance float64) *ScoredEvent {
	now := time.Now().UTC()
	return &ScoredEvent{
		ID:           uuid.New(),
		EventID:      eventID,
		DeveloperID:  developerID,
		UserID:       userID,
		QualityScore: qualityScore,
		IsHuman:      isHuman,
		Jitter:       jitter,
		TimeVariance: timeVariance,
		ProcessedAt:  now,
		CreatedAt:    now,
	}
}
