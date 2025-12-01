package postgres

import (
	"time"

	"github.com/google/uuid"
)

// WalletGorm represents the database model for wallets.
type WalletGorm struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;"`
	OwnerID   uuid.UUID `gorm:"type:uuid;index;not null"`
	Type      string    `gorm:"not null"`
	Balance   float64   `gorm:"not null;default:0"`
	Currency  string    `gorm:"not null;default:'USD'"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (WalletGorm) TableName() string {
	return "wallets"
}

// CampaignGorm represents the database model for campaigns.
type CampaignGorm struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;"`
	BuyerID     uuid.UUID `gorm:"type:uuid;index;not null"`
	Name        string    `gorm:"not null"`
	TotalBudget float64   `gorm:"not null"`
	Remaining   float64   `gorm:"not null"`
	Status      string    `gorm:"not null;default:'active'"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (CampaignGorm) TableName() string {
	return "campaigns"
}

// LedgerTransactionGorm represents the database model for ledger transactions.
type LedgerTransactionGorm struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;"`
	SourceWalletID uuid.UUID `gorm:"type:uuid;index;not null"`
	DestWalletID   uuid.UUID `gorm:"type:uuid;index;not null"`
	Amount         float64   `gorm:"not null"`
	Currency       string    `gorm:"not null"`
	ReferenceID    uuid.UUID `gorm:"type:uuid;index"`
	Type           string    `gorm:"not null"`
	Status         string    `gorm:"not null;default:'pending'"`
	CreatedAt      time.Time
}

func (LedgerTransactionGorm) TableName() string {
	return "ledger_transactions"
}
