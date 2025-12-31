package domain

import (
	"time"

	"github.com/google/uuid"
)

// AdType represents the type of advertisement
type AdType string

const (
	AdTypeBanner       AdType = "banner"
	AdTypeInterstitial AdType = "interstitial"
	AdTypeRewarded     AdType = "rewarded"
)

// AdImpression represents a single ad impression event
// This is recorded when a user views an ad in a developer's app
type AdImpression struct {
	ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`

	// Relationships
	ApplicationID uuid.UUID `gorm:"type:uuid;index;not null" json:"application_id"`
	UserID        uuid.UUID `gorm:"type:uuid;index;not null" json:"user_id"`        // DataClaus user
	DeveloperID   uuid.UUID `gorm:"type:uuid;index;not null" json:"developer_id"`

	// Ad Details
	AdType        AdType `gorm:"type:varchar(20);not null" json:"ad_type"`
	AdUnitID      string `gorm:"type:varchar(100)" json:"ad_unit_id"`       // Google AdMob unit ID
	AdNetworkName string `gorm:"default:'admob'" json:"ad_network_name"`

	// Revenue (in USD)
	GrossRevenue float64 `gorm:"not null" json:"gross_revenue"`  // Total from ad network
	UserShare    float64 `gorm:"not null" json:"user_share"`     // User's portion
	DevShare     float64 `gorm:"not null" json:"dev_share"`      // Developer's portion
	PlatformFee  float64 `gorm:"not null" json:"platform_fee"`   // Platform's 5%

	// Distribution Status
	Distributed   bool       `gorm:"default:false" json:"distributed"`
	DistributedAt *time.Time `json:"distributed_at,omitempty"`

	// Tracking
	SessionID   *uuid.UUID `gorm:"type:uuid" json:"session_id,omitempty"`
	IPAddress   string     `gorm:"type:varchar(50)" json:"ip_address,omitempty"`
	DeviceInfo  string     `gorm:"type:text" json:"device_info,omitempty"` // JSON
	CountryCode string     `gorm:"type:varchar(2)" json:"country_code,omitempty"`

	// Metadata
	Currency  string    `gorm:"default:'USD'" json:"currency"`
	CreatedAt time.Time `json:"created_at"`
}

// TableName specifies the table name for GORM
func (AdImpression) TableName() string {
	return "ad_impressions"
}

// AdRevenueSummary represents aggregated revenue data
type AdRevenueSummary struct {
	TotalImpressions   int64   `json:"total_impressions"`
	TotalGrossRevenue  float64 `json:"total_gross_revenue"`
	TotalUserShare     float64 `json:"total_user_share"`
	TotalDevShare      float64 `json:"total_dev_share"`
	TotalPlatformFee   float64 `json:"total_platform_fee"`
	AverageEcpm        float64 `json:"average_ecpm"` // Effective CPM
	BannerImpressions  int64   `json:"banner_impressions"`
	InterstitialCount  int64   `json:"interstitial_count"`
	RewardedCount      int64   `json:"rewarded_count"`
}

// AdConfig represents ad configuration for an application
type AdConfig struct {
	ApplicationID    uuid.UUID `json:"application_id"`
	UserSharePercent int       `json:"user_share_percent"` // 50-90
	DevSharePercent  int       `json:"dev_share_percent"`  // Calculated
	PlatformPercent  int       `json:"platform_percent"`   // Fixed 5%
	EnabledAdTypes   []AdType  `json:"enabled_ad_types"`
	MinimumEcpm      float64   `json:"minimum_ecpm"` // Minimum eCPM to track
}

// CalculateAdRevenueSplit calculates the revenue split for an ad impression
func CalculateAdRevenueSplit(grossRevenue float64, userSharePercent int) (userShare, devShare, platformFee float64) {
	// Validate user share
	if userSharePercent < MinUserSharePercent {
		userSharePercent = MinUserSharePercent
	}
	if userSharePercent > MaxUserSharePercent {
		userSharePercent = MaxUserSharePercent
	}

	// Calculate shares
	devSharePercent := 100 - PlatformFeePercent - userSharePercent

	platformFee = grossRevenue * float64(PlatformFeePercent) / 100.0
	userShare = grossRevenue * float64(userSharePercent) / 100.0
	devShare = grossRevenue * float64(devSharePercent) / 100.0

	return userShare, devShare, platformFee
}

// GetEcpmByAdType returns estimated eCPM values by ad type (in USD)
func GetEcpmByAdType(adType AdType) float64 {
	// eCPM = earnings per 1000 impressions
	switch adType {
	case AdTypeBanner:
		return 0.50 // $0.50 per 1000 impressions
	case AdTypeInterstitial:
		return 5.00 // $5.00 per 1000 impressions
	case AdTypeRewarded:
		return 15.00 // $15.00 per 1000 impressions
	default:
		return 0.50
	}
}

// GetRevenuePerImpression returns revenue per single impression
func GetRevenuePerImpression(adType AdType) float64 {
	return GetEcpmByAdType(adType) / 1000.0
}
