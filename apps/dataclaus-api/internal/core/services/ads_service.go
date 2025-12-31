package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"apps/dataclaus-api/internal/adapters/repository/postgres"
	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
)

// Ad-related errors
var (
	ErrInvalidAdType     = errors.New("invalid ad type")
	ErrApplicationNotFound = errors.New("application not found")
	ErrDailyLimitReached = errors.New("daily impression limit reached")
	ErrInvalidRevenue    = errors.New("revenue must be positive")
)

// Daily impression limits by ad type (to prevent fraud)
const (
	MaxBannerImpressionsPerDay       = 1000
	MaxInterstitialImpressionsPerDay = 100
	MaxRewardedImpressionsPerDay     = 50
)

// AdsService handles ad impression tracking and revenue distribution
type AdsService struct {
	repo            *postgres.AdImpressionRepository
	appRepo         *postgres.ApplicationRepository
	walletService   ports.WalletService
	dataclausUserRepo *postgres.DataClausUserRepository
}

// NewAdsService creates a new ads service instance
func NewAdsService(
	repo *postgres.AdImpressionRepository,
	appRepo *postgres.ApplicationRepository,
	walletService ports.WalletService,
	dataclausUserRepo *postgres.DataClausUserRepository,
) *AdsService {
	return &AdsService{
		repo:            repo,
		appRepo:         appRepo,
		walletService:   walletService,
		dataclausUserRepo: dataclausUserRepo,
	}
}

// RecordImpressionRequest contains the request to record an ad impression
type RecordImpressionRequest struct {
	ApplicationID uuid.UUID      `json:"application_id"`
	UserID        uuid.UUID      `json:"user_id"`
	AdType        domain.AdType  `json:"ad_type"`
	GrossRevenue  float64        `json:"gross_revenue"` // If 0, will use estimated eCPM
	AdUnitID      string         `json:"ad_unit_id,omitempty"`
	SessionID     *uuid.UUID     `json:"session_id,omitempty"`
	IPAddress     string         `json:"ip_address,omitempty"`
	DeviceInfo    string         `json:"device_info,omitempty"`
	CountryCode   string         `json:"country_code,omitempty"`
}

// RecordImpressionResult contains the result of recording an impression
type RecordImpressionResult struct {
	ImpressionID  uuid.UUID `json:"impression_id"`
	GrossRevenue  float64   `json:"gross_revenue"`
	UserShare     float64   `json:"user_share"`
	DevShare      float64   `json:"dev_share"`
	PlatformFee   float64   `json:"platform_fee"`
	UserNewTotal  float64   `json:"user_new_total"`  // User's new total earned
	Distributed   bool      `json:"distributed"`
}

// RecordImpression records an ad impression and distributes revenue
func (s *AdsService) RecordImpression(ctx context.Context, req RecordImpressionRequest) (*RecordImpressionResult, error) {
	// Validate ad type
	if !isValidAdType(req.AdType) {
		return nil, ErrInvalidAdType
	}

	// Get application to find developer ID and user share config
	app, err := s.appRepo.GetByID(ctx, req.ApplicationID)
	if err != nil {
		return nil, ErrApplicationNotFound
	}

	// Check daily limit for this user and ad type
	count, err := s.repo.CountByUserAndTypeToday(ctx, req.UserID, req.AdType)
	if err != nil {
		return nil, fmt.Errorf("failed to check daily limit: %w", err)
	}

	maxImpressions := getMaxImpressionsPerDay(req.AdType)
	if count >= int64(maxImpressions) {
		return nil, ErrDailyLimitReached
	}

	// Calculate revenue if not provided
	grossRevenue := req.GrossRevenue
	if grossRevenue <= 0 {
		grossRevenue = domain.GetRevenuePerImpression(req.AdType)
	}

	// Get user share percentage from developer settings
	userSharePercent := domain.DefaultUserSharePercent
	if app.UserSharePercent > 0 {
		userSharePercent = app.UserSharePercent
	}

	// Calculate revenue split
	userShare, devShare, platformFee := domain.CalculateAdRevenueSplit(grossRevenue, userSharePercent)

	// Create impression record
	impression := &domain.AdImpression{
		ID:            uuid.New(),
		ApplicationID: req.ApplicationID,
		UserID:        req.UserID,
		DeveloperID:   app.DeveloperID,
		AdType:        req.AdType,
		AdUnitID:      req.AdUnitID,
		AdNetworkName: "admob",
		GrossRevenue:  grossRevenue,
		UserShare:     userShare,
		DevShare:      devShare,
		PlatformFee:   platformFee,
		Distributed:   false,
		SessionID:     req.SessionID,
		IPAddress:     req.IPAddress,
		DeviceInfo:    req.DeviceInfo,
		CountryCode:   req.CountryCode,
		Currency:      "USD",
		CreatedAt:     time.Now(),
	}

	if err := s.repo.Create(ctx, impression); err != nil {
		return nil, fmt.Errorf("failed to create impression: %w", err)
	}

	// Distribute revenue immediately
	var userNewTotal float64
	distributed := false

	if err := s.distributeRevenue(ctx, impression); err != nil {
		// Log error but don't fail the request - will be distributed later
		fmt.Printf("[ADS] Failed to distribute revenue for impression %s: %v\n", impression.ID, err)
	} else {
		distributed = true
		// Mark as distributed
		_ = s.repo.MarkDistributed(ctx, impression.ID)
	}

	// Get user's new total
	user, err := s.dataclausUserRepo.GetByID(ctx, req.UserID)
	if err == nil {
		userNewTotal = user.TotalEarned
	}

	return &RecordImpressionResult{
		ImpressionID:  impression.ID,
		GrossRevenue:  grossRevenue,
		UserShare:     userShare,
		DevShare:      devShare,
		PlatformFee:   platformFee,
		UserNewTotal:  userNewTotal,
		Distributed:   distributed,
	}, nil
}

// distributeRevenue distributes the revenue to user and developer wallets
func (s *AdsService) distributeRevenue(ctx context.Context, impression *domain.AdImpression) error {
	// Get user to find their wallet
	user, err := s.dataclausUserRepo.GetByID(ctx, impression.UserID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Credit user's pending balance (micro-payments go to pending first)
	if s.walletService != nil && user.WalletID != uuid.Nil {
		if err := s.walletService.CreditPending(ctx, user.WalletID, impression.UserShare); err != nil {
			return fmt.Errorf("failed to credit user wallet: %w", err)
		}

		// Try to release pending if threshold met
		_, _ = s.walletService.ReleasePendingIfThreshold(ctx, user.WalletID)
	}

	// Update user's total earned and pending balance in user record
	newTotal := user.TotalEarned + impression.UserShare
	newPending := user.PendingBalance + impression.UserShare

	if err := s.dataclausUserRepo.UpdateEarnings(ctx, user.ID, newTotal, newPending); err != nil {
		return fmt.Errorf("failed to update user earnings: %w", err)
	}

	// Credit developer's wallet
	app, err := s.appRepo.GetByID(ctx, impression.ApplicationID)
	if err == nil && app.DeveloperID != uuid.Nil {
		wallets, err := s.walletService.GetByOwner(ctx, app.DeveloperID)
		if err == nil && len(wallets) > 0 {
			if err := s.walletService.CreditPending(ctx, wallets[0].ID, impression.DevShare); err != nil {
				fmt.Printf("[ADS] Failed to credit developer wallet: %v\n", err)
			}
			// Try to release pending
			_, _ = s.walletService.ReleasePendingIfThreshold(ctx, wallets[0].ID)
		}
	}

	// Platform fee goes to platform wallet (if exists)
	// For now, just log it
	fmt.Printf("[ADS] Platform fee: $%.6f from impression %s\n", impression.PlatformFee, impression.ID)

	return nil
}

// GetAdConfig returns the ad configuration for an application
func (s *AdsService) GetAdConfig(ctx context.Context, appID uuid.UUID) (*domain.AdConfig, error) {
	app, err := s.appRepo.GetByID(ctx, appID)
	if err != nil {
		return nil, ErrApplicationNotFound
	}

	userSharePercent := domain.DefaultUserSharePercent
	if app.UserSharePercent > 0 {
		userSharePercent = app.UserSharePercent
	}

	devSharePercent := 100 - domain.PlatformFeePercent - userSharePercent

	return &domain.AdConfig{
		ApplicationID:    appID,
		UserSharePercent: userSharePercent,
		DevSharePercent:  devSharePercent,
		PlatformPercent:  domain.PlatformFeePercent,
		EnabledAdTypes:   []domain.AdType{domain.AdTypeBanner, domain.AdTypeInterstitial, domain.AdTypeRewarded},
		MinimumEcpm:      0.10, // $0.10 minimum eCPM
	}, nil
}

// GetUserRevenueSummary gets revenue summary for a user
func (s *AdsService) GetUserRevenueSummary(ctx context.Context, userID uuid.UUID, period string) (*domain.AdRevenueSummary, error) {
	startTime, endTime := parsePeriod(period)
	return s.repo.GetUserSummary(ctx, userID, startTime, endTime)
}

// GetApplicationRevenueSummary gets revenue summary for an application
func (s *AdsService) GetApplicationRevenueSummary(ctx context.Context, appID uuid.UUID, period string) (*domain.AdRevenueSummary, error) {
	startTime, endTime := parsePeriod(period)
	return s.repo.GetApplicationSummary(ctx, appID, startTime, endTime)
}

// GetDeveloperRevenueSummary gets revenue summary for a developer
func (s *AdsService) GetDeveloperRevenueSummary(ctx context.Context, devID uuid.UUID, period string) (*domain.AdRevenueSummary, error) {
	startTime, endTime := parsePeriod(period)
	return s.repo.GetDeveloperSummary(ctx, devID, startTime, endTime)
}

// ProcessUndistributed processes pending revenue distributions
func (s *AdsService) ProcessUndistributed(ctx context.Context) (int, error) {
	impressions, err := s.repo.GetUndistributed(ctx, 100)
	if err != nil {
		return 0, err
	}

	distributed := 0
	for _, impression := range impressions {
		if err := s.distributeRevenue(ctx, &impression); err != nil {
			fmt.Printf("[ADS] Failed to distribute impression %s: %v\n", impression.ID, err)
			continue
		}
		if err := s.repo.MarkDistributed(ctx, impression.ID); err != nil {
			fmt.Printf("[ADS] Failed to mark distributed %s: %v\n", impression.ID, err)
			continue
		}
		distributed++
	}

	return distributed, nil
}

// Helper functions

func isValidAdType(adType domain.AdType) bool {
	switch adType {
	case domain.AdTypeBanner, domain.AdTypeInterstitial, domain.AdTypeRewarded:
		return true
	default:
		return false
	}
}

func getMaxImpressionsPerDay(adType domain.AdType) int {
	switch adType {
	case domain.AdTypeBanner:
		return MaxBannerImpressionsPerDay
	case domain.AdTypeInterstitial:
		return MaxInterstitialImpressionsPerDay
	case domain.AdTypeRewarded:
		return MaxRewardedImpressionsPerDay
	default:
		return MaxBannerImpressionsPerDay
	}
}

func parsePeriod(period string) (time.Time, time.Time) {
	now := time.Now()
	endTime := now

	switch period {
	case "today":
		startTime := now.Truncate(24 * time.Hour)
		return startTime, endTime
	case "week":
		startTime := now.AddDate(0, 0, -7)
		return startTime, endTime
	case "month":
		startTime := now.AddDate(0, -1, 0)
		return startTime, endTime
	case "year":
		startTime := now.AddDate(-1, 0, 0)
		return startTime, endTime
	case "all":
		startTime := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
		return startTime, endTime
	default:
		// Default to last 30 days
		startTime := now.AddDate(0, 0, -30)
		return startTime, endTime
	}
}
