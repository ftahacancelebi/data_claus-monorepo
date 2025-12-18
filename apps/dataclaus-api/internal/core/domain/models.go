package domain

import (
	"time"

	"github.com/google/uuid"
)

// Revenue sharing constants
const (
	PlatformFeePercent       = 5    // Platform takes fixed 5%
	MinPayoutThreshold       = 0.01 // Minimum $0.01 to release from pending
	DefaultUserSharePercent  = 70   // Default user share (developer can adjust)
	MinUserSharePercent      = 50   // Minimum user share allowed
	MaxUserSharePercent      = 90   // Maximum user share allowed
)

// Wallet represents a digital wallet for a user or entity.
type Wallet struct {
	ID             uuid.UUID
	OwnerID        uuid.UUID // Can be UserID or a System ID
	Type           string    // "user", "developer", "buyer", "faucet", "platform"
	Balance        float64   // Available balance (released from pending)
	PendingBalance float64   // Accumulated micro-payments below threshold
	Currency       string    // "USD", "EUR", "CLS" (Claus Token)
	CreatedAt      time.Time
	UpdatedAt      time.Time
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
	ID             uuid.UUID
	SourceWalletID uuid.UUID
	DestWalletID   uuid.UUID
	Amount         float64
	Currency       string
	ReferenceID    uuid.UUID // e.g., CampaignID or SessionID
	Type           string    // "payout", "deposit", "fee", "pending_release"
	Status         string    // "pending", "completed", "failed"
	CreatedAt      time.Time
}

// UserSession tracks active usage time for earnings calculation
type UserSession struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	DeveloperID   uuid.UUID
	CampaignID    *uuid.UUID
	StartTime     time.Time
	EndTime       *time.Time
	ActiveSeconds int64   // Total active (unfrozen) time in seconds
	QualityScore  float64 // Average quality score during session
	Earnings      float64 // Calculated earnings for this session
	Status        string  // "active", "completed", "frozen"
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// PayoutCalculation represents the breakdown of a payout
type PayoutCalculation struct {
	TotalAmount     float64
	UserAmount      float64
	DeveloperAmount float64
	PlatformFee     float64
	QualityScore    float64
	ActiveSeconds   int64
}

// CalculatePayout calculates earnings based on quality score and active time
// Formula: quality_score * active_time_hours * hourly_rate
// userSharePercent is set by the developer (50-90%), platform takes 5%, developer gets the rest
func CalculatePayout(qualityScore float64, activeSeconds int64, campaignRatePerHour float64, userSharePercent int) *PayoutCalculation {
	if activeSeconds <= 0 || qualityScore <= 0 || campaignRatePerHour <= 0 {
		return &PayoutCalculation{}
	}

	// Validate and default user share
	if userSharePercent < MinUserSharePercent || userSharePercent > MaxUserSharePercent {
		userSharePercent = DefaultUserSharePercent
	}

	developerSharePercent := 100 - PlatformFeePercent - userSharePercent

	activeHours := float64(activeSeconds) / 3600.0
	totalAmount := qualityScore * activeHours * campaignRatePerHour

	return &PayoutCalculation{
		TotalAmount:     totalAmount,
		UserAmount:      totalAmount * float64(userSharePercent) / 100.0,
		DeveloperAmount: totalAmount * float64(developerSharePercent) / 100.0,
		PlatformFee:     totalAmount * float64(PlatformFeePercent) / 100.0,
		QualityScore:    qualityScore,
		ActiveSeconds:   activeSeconds,
	}
}

// ShouldReleasePending checks if pending balance should be released to available
func (w *Wallet) ShouldReleasePending() bool {
	return w.PendingBalance >= MinPayoutThreshold
}

// ReleasePending moves pending balance to available balance
func (w *Wallet) ReleasePending() float64 {
	if w.PendingBalance >= MinPayoutThreshold {
		amount := w.PendingBalance
		w.Balance += amount
		w.PendingBalance = 0
		return amount
	}
	return 0
}
