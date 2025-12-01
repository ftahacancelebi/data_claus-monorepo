package domain

import (
	"time"

	"github.com/google/uuid"
)

// Wallet represents a digital wallet for a user or entity.
type Wallet struct {
	ID        uuid.UUID
	OwnerID   uuid.UUID // Can be UserID or a System ID
	Type      string    // "user", "developer", "faucet", "platform"
	Balance   float64
	Currency  string // "USD", "EUR", "CLS" (Claus Token)
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Campaign represents an ad campaign created by a buyer.
type Campaign struct {
	ID          uuid.UUID
	BuyerID     uuid.UUID // Link to a User (Buyer)
	Name        string
	TotalBudget float64
	Remaining   float64
	Status      string // "active", "paused", "completed"
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// LedgerTransaction represents an immutable financial record.
type LedgerTransaction struct {
	ID          uuid.UUID
	SourceWalletID uuid.UUID
	DestWalletID   uuid.UUID
	Amount         float64
	Currency       string
	ReferenceID    uuid.UUID // e.g., CampaignID or SessionID
	Type           string    // "payout", "deposit", "fee"
	Status         string    // "pending", "completed", "failed"
	CreatedAt      time.Time
}
