package services

import (
	"context"
	"errors"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
)

type PayoutService struct {
	walletRepo    ports.WalletRepository
	campaignRepo  ports.CampaignRepository
	ledgerRepo    ports.LedgerRepository
	developerRepo ports.DeveloperRepository
}

func NewPayoutService(
	walletRepo ports.WalletRepository,
	campaignRepo ports.CampaignRepository,
	ledgerRepo ports.LedgerRepository,
	developerRepo ports.DeveloperRepository,
) ports.PayoutService {
	return &PayoutService{
		walletRepo:    walletRepo,
		campaignRepo:  campaignRepo,
		ledgerRepo:    ledgerRepo,
		developerRepo: developerRepo,
	}
}

// GetCampaignRatePerHour calculates hourly rate based on campaign budget
// This is a simplified calculation - in production you'd have more sophisticated pricing
func (s *PayoutService) GetCampaignRatePerHour(ctx context.Context, campaignID uuid.UUID) (float64, error) {
	campaign, err := s.campaignRepo.GetByID(ctx, campaignID)
	if err != nil {
		return 0, err
	}

	if campaign.Status != "active" {
		return 0, errors.New("campaign is not active")
	}

	if campaign.Remaining <= 0 {
		return 0, errors.New("campaign has no remaining budget")
	}

	// Base rate: $0.10 per hour at 100% quality
	// Campaigns with larger budgets can afford higher rates
	baseRate := 0.10
	
	// Scale rate based on remaining budget (more budget = slightly higher rate to attract users)
	if campaign.Remaining > 10000 {
		baseRate = 0.15
	} else if campaign.Remaining > 1000 {
		baseRate = 0.12
	}

	return baseRate, nil
}

// ProcessEventPayout processes a single event and distributes earnings
func (s *PayoutService) ProcessEventPayout(ctx context.Context, event *domain.ScoredEvent, campaignID uuid.UUID) (*domain.PayoutCalculation, error) {
	if event.QualityScore <= 0 {
		return &domain.PayoutCalculation{}, nil
	}

	hourlyRate, err := s.GetCampaignRatePerHour(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	// Get developer's configured user share percentage
	userSharePercent := domain.DefaultUserSharePercent
	if developer, err := s.developerRepo.GetByID(ctx, event.DeveloperID); err == nil {
		userSharePercent = developer.UserSharePercent
	}

	// For events, we estimate ~1 minute of active time per event
	activeSeconds := int64(60)
	
	calc := domain.CalculatePayout(event.QualityScore, activeSeconds, hourlyRate, userSharePercent)
	if calc.TotalAmount <= 0 {
		return calc, nil
	}

	// Deduct from campaign
	if err := s.campaignRepo.DeductBudget(ctx, campaignID, calc.TotalAmount); err != nil {
		return nil, err
	}

	// Credit user (to pending if below threshold)
	userWallets, err := s.walletRepo.GetByOwnerID(ctx, event.UserID)
	if err == nil && len(userWallets) > 0 {
		if calc.UserAmount < domain.MinPayoutThreshold {
			s.walletRepo.UpdatePendingBalance(ctx, userWallets[0].ID, calc.UserAmount)
		} else {
			s.walletRepo.UpdateBalance(ctx, userWallets[0].ID, calc.UserAmount)
		}
	}

	// Credit developer (to pending if below threshold)
	devWallets, err := s.walletRepo.GetByOwnerID(ctx, event.DeveloperID)
	if err == nil && len(devWallets) > 0 {
		if calc.DeveloperAmount < domain.MinPayoutThreshold {
			s.walletRepo.UpdatePendingBalance(ctx, devWallets[0].ID, calc.DeveloperAmount)
		} else {
			s.walletRepo.UpdateBalance(ctx, devWallets[0].ID, calc.DeveloperAmount)
		}
	}

	return calc, nil
}

// ProcessSessionPayout processes a completed session and distributes earnings
func (s *PayoutService) ProcessSessionPayout(ctx context.Context, session *domain.UserSession) (*domain.PayoutCalculation, error) {
	if session.QualityScore <= 0 || session.ActiveSeconds <= 0 {
		return &domain.PayoutCalculation{}, nil
	}

	if session.CampaignID == nil {
		return &domain.PayoutCalculation{}, errors.New("session has no campaign")
	}

	hourlyRate, err := s.GetCampaignRatePerHour(ctx, *session.CampaignID)
	if err != nil {
		return nil, err
	}

	// Get developer's configured user share percentage
	userSharePercent := domain.DefaultUserSharePercent
	if developer, err := s.developerRepo.GetByID(ctx, session.DeveloperID); err == nil {
		userSharePercent = developer.UserSharePercent
	}

	calc := domain.CalculatePayout(session.QualityScore, session.ActiveSeconds, hourlyRate, userSharePercent)
	if calc.TotalAmount <= 0 {
		return calc, nil
	}

	// Deduct from campaign
	if err := s.campaignRepo.DeductBudget(ctx, *session.CampaignID, calc.TotalAmount); err != nil {
		return nil, err
	}

	// Credit user
	userWallets, err := s.walletRepo.GetByOwnerID(ctx, session.UserID)
	if err == nil && len(userWallets) > 0 {
		if calc.UserAmount < domain.MinPayoutThreshold {
			s.walletRepo.UpdatePendingBalance(ctx, userWallets[0].ID, calc.UserAmount)
		} else {
			s.walletRepo.UpdateBalance(ctx, userWallets[0].ID, calc.UserAmount)
		}
	}

	// Credit developer
	devWallets, err := s.walletRepo.GetByOwnerID(ctx, session.DeveloperID)
	if err == nil && len(devWallets) > 0 {
		if calc.DeveloperAmount < domain.MinPayoutThreshold {
			s.walletRepo.UpdatePendingBalance(ctx, devWallets[0].ID, calc.DeveloperAmount)
		} else {
			s.walletRepo.UpdateBalance(ctx, devWallets[0].ID, calc.DeveloperAmount)
		}
	}

	return calc, nil
}
