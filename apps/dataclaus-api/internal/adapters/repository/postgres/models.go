package postgres

import (
	"time"

	"github.com/google/uuid"
)

type WalletGorm struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;"`
	OwnerID        uuid.UUID `gorm:"type:uuid;index;not null"`
	Type           string    `gorm:"not null"`
	Balance        float64   `gorm:"type:decimal(20,8);not null;default:0"` // High precision for micro-payments
	PendingBalance float64   `gorm:"type:decimal(20,8);not null;default:0"` // Pending micro-payments
	Currency       string    `gorm:"not null;default:'USD'"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func (WalletGorm) TableName() string {
	return "wallets"
}

type CampaignGorm struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;"`
	BuyerID     uuid.UUID `gorm:"type:uuid;index;not null"`
	Name        string    `gorm:"not null"`
	TotalBudget float64   `gorm:"type:decimal(20,8);not null"`
	Remaining   float64   `gorm:"type:decimal(20,8);not null"`
	Status      string    `gorm:"not null;default:'active'"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (CampaignGorm) TableName() string {
	return "campaigns"
}

type LedgerTransactionGorm struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;"`
	SourceWalletID uuid.UUID `gorm:"type:uuid;index;not null"`
	DestWalletID   uuid.UUID `gorm:"type:uuid;index;not null"`
	Amount         float64   `gorm:"type:decimal(20,8);not null"` // High precision
	Currency       string    `gorm:"not null"`
	ReferenceID    uuid.UUID `gorm:"type:uuid;index"`
	Type           string    `gorm:"not null"`
	Status         string    `gorm:"not null;default:'pending'"`
	CreatedAt      time.Time
}

func (LedgerTransactionGorm) TableName() string {
	return "ledger_transactions"
}

type DeveloperGorm struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key;"`
	Name             string    `gorm:"not null"`
	Email            string    `gorm:"uniqueIndex;not null"`
	Password         string    `gorm:"not null"`
	UserSharePercent int       `gorm:"not null;default:70"` // Developer-configurable user share (50-90%)
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (DeveloperGorm) TableName() string {
	return "developers"
}

type APIKeyGorm struct {
	ID          uuid.UUID  `gorm:"type:uuid;primary_key;"`
	DeveloperID uuid.UUID  `gorm:"type:uuid;index;not null"`
	KeyHash     string     `gorm:"uniqueIndex;not null"`
	KeyPrefix   string     `gorm:"not null"`
	Name        string     `gorm:"not null"`
	IsActive    bool       `gorm:"not null;default:true"`
	LastUsedAt  *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (APIKeyGorm) TableName() string {
	return "api_keys"
}

type ScoredEventGorm struct {
	ID           uuid.UUID  `gorm:"type:uuid;primary_key;"`
	EventID      string     `gorm:"uniqueIndex;not null"`
	DeveloperID  uuid.UUID  `gorm:"type:uuid;index;not null"`
	UserID       uuid.UUID  `gorm:"type:uuid;index;not null"`
	QualityScore float64    `gorm:"type:decimal(10,6);not null"`
	IsHuman      bool       `gorm:"not null"`
	Jitter       float64    `gorm:"type:decimal(10,6);not null"`
	TimeVariance float64    `gorm:"type:decimal(10,6);not null"`
	CampaignID   *uuid.UUID `gorm:"type:uuid;index"`
	Payout       float64    `gorm:"type:decimal(20,8);not null;default:0"` // High precision
	ProcessedAt  time.Time
	CreatedAt    time.Time
}

func (ScoredEventGorm) TableName() string {
	return "scored_events"
}

type UserSessionGorm struct {
	ID            uuid.UUID  `gorm:"type:uuid;primary_key;"`
	UserID        uuid.UUID  `gorm:"type:uuid;index;not null"`
	DeveloperID   uuid.UUID  `gorm:"type:uuid;index;not null"`
	CampaignID    *uuid.UUID `gorm:"type:uuid;index"`
	StartTime     time.Time  `gorm:"not null"`
	EndTime       *time.Time
	ActiveSeconds int64      `gorm:"not null;default:0"`
	QualityScore  float64    `gorm:"type:decimal(10,6);not null;default:0"`
	Earnings      float64    `gorm:"type:decimal(20,8);not null;default:0"`
	Status        string     `gorm:"not null;default:'active'"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func (UserSessionGorm) TableName() string {
	return "user_sessions"
}
