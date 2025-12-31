package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"apps/dataclaus-api/internal/adapters/repository/postgres"
	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Common errors for the DataClaus user service
var (
	ErrDataClausUserNotFound = errors.New("dataclaus user not found")
	ErrInvalidOTP            = errors.New("invalid or expired OTP")
	ErrInvalidUserToken      = errors.New("invalid or expired token")
	ErrPhoneRequired         = errors.New("phone number is required")
	ErrUserAlreadyExists     = errors.New("user with this phone already exists")
)

// OTP configuration
const (
	OTPLength              = 6
	OTPExpiryMins          = 5
	TokenExpiryHours       = 24
	RefreshTokenExpiryDays = 30
)

// DataClausUserService handles business logic for DataClaus users
type DataClausUserService struct {
	repo          *postgres.DataClausUserRepository
	walletService ports.WalletService
}

// NewDataClausUserService creates a new service instance
func NewDataClausUserService(repo *postgres.DataClausUserRepository, walletService ports.WalletService) *DataClausUserService {
	return &DataClausUserService{
		repo:          repo,
		walletService: walletService,
	}
}

// ========================
// OTP Authentication
// ========================

// RequestOTPResponse contains the result of an OTP request
type RequestOTPResponse struct {
	ExpiresIn int    `json:"expires_in"` // seconds
	Message   string `json:"message"`
}

// RequestOTP generates and stores an OTP for a phone number
func (s *DataClausUserService) RequestOTP(ctx context.Context, phone string) (*RequestOTPResponse, error) {
	if phone == "" {
		return nil, ErrPhoneRequired
	}

	// Generate 6-digit OTP
	otp, err := generateOTP(OTPLength)
	if err != nil {
		return nil, fmt.Errorf("failed to generate OTP: %w", err)
	}

	// Hash OTP for storage
	otpHash := hashOTP(otp)

	// Create OTP record
	otpRecord := &domain.OTPCode{
		ID:        uuid.New(),
		Phone:     phone,
		Code:      otpHash,
		ExpiresAt: time.Now().Add(OTPExpiryMins * time.Minute),
		Used:      false,
		CreatedAt: time.Now(),
	}

	if err := s.repo.CreateOTP(ctx, otpRecord); err != nil {
		return nil, fmt.Errorf("failed to create OTP: %w", err)
	}

	// In production, send OTP via SMS gateway
	// For now, log it (development only)
	fmt.Printf("[OTP] Phone: %s, Code: %s (expires in %d mins)\n", phone, otp, OTPExpiryMins)

	return &RequestOTPResponse{
		ExpiresIn: OTPExpiryMins * 60,
		Message:   "OTP sent successfully",
	}, nil
}

// VerifyOTPResponse contains the result of OTP verification
type VerifyOTPResponse struct {
	User         *domain.DataClausUser `json:"user"`
	AccessToken  string                `json:"access_token"`
	RefreshToken string                `json:"refresh_token"`
	ExpiresIn    int                   `json:"expires_in"` // seconds
	IsNewUser    bool                  `json:"is_new_user"`
}

// VerifyOTP verifies an OTP code and creates/returns a user session
func (s *DataClausUserService) VerifyOTP(ctx context.Context, phone, code string) (*VerifyOTPResponse, error) {
	if phone == "" {
		return nil, ErrPhoneRequired
	}

	// Hash the provided OTP to compare
	codeHash := hashOTP(code)

	// Find valid OTP
	otp, err := s.repo.GetValidOTP(ctx, phone, codeHash)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidOTP
		}
		return nil, fmt.Errorf("failed to verify OTP: %w", err)
	}

	// Mark OTP as used
	if err := s.repo.MarkOTPUsed(ctx, otp.ID); err != nil {
		return nil, fmt.Errorf("failed to mark OTP as used: %w", err)
	}

	// Get or create user
	user, isNew, err := s.getOrCreateUser(ctx, phone)
	if err != nil {
		return nil, fmt.Errorf("failed to get/create user: %w", err)
	}

	// Update phone verified status
	if !user.PhoneVerified {
		user.PhoneVerified = true
		if err := s.repo.Update(ctx, user); err != nil {
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
	}

	// Create session with tokens
	accessToken, refreshToken, err := s.createSession(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Update last login
	_ = s.repo.UpdateLastLogin(ctx, user.ID)

	return &VerifyOTPResponse{
		User:         user,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    TokenExpiryHours * 3600,
		IsNewUser:    isNew,
	}, nil
}

// ========================
// Token Management
// ========================

// ValidateToken validates an access token and returns the user
func (s *DataClausUserService) ValidateToken(ctx context.Context, token string) (*domain.DataClausUser, error) {
	session, err := s.repo.GetSessionByAccessToken(ctx, token)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidUserToken
		}
		return nil, fmt.Errorf("failed to validate token: %w", err)
	}

	if session.IsExpired() {
		return nil, ErrInvalidUserToken
	}

	user, err := s.repo.GetByID(ctx, session.UserID)
	if err != nil {
		return nil, ErrDataClausUserNotFound
	}

	return user, nil
}

// RefreshToken generates new tokens using a refresh token
func (s *DataClausUserService) RefreshToken(ctx context.Context, refreshToken string) (*VerifyOTPResponse, error) {
	session, err := s.repo.GetSessionByRefreshToken(ctx, refreshToken)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidUserToken
		}
		return nil, fmt.Errorf("failed to find session: %w", err)
	}

	user, err := s.repo.GetByID(ctx, session.UserID)
	if err != nil {
		return nil, ErrDataClausUserNotFound
	}

	// Delete old session
	_ = s.repo.DeleteSession(ctx, session.AccessToken)

	// Create new session
	accessToken, newRefreshToken, err := s.createSession(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	return &VerifyOTPResponse{
		User:         user,
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    TokenExpiryHours * 3600,
		IsNewUser:    false,
	}, nil
}

// Logout invalidates a user's session
func (s *DataClausUserService) Logout(ctx context.Context, token string) error {
	return s.repo.DeleteSession(ctx, token)
}

// ========================
// Profile Management
// ========================

// UserProfile represents a user's profile data
type UserProfile struct {
	ID             uuid.UUID `json:"id"`
	Phone          string    `json:"phone"`
	Email          *string   `json:"email,omitempty"`
	DisplayName    *string   `json:"display_name,omitempty"`
	AvatarURL      *string   `json:"avatar_url,omitempty"`
	QualityScore   float64   `json:"quality_score"`
	TotalEarned    float64   `json:"total_earned"`
	PendingBalance float64   `json:"pending_balance"`
}

// GetProfile retrieves a user's profile
func (s *DataClausUserService) GetProfile(ctx context.Context, userID uuid.UUID) (*UserProfile, error) {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDataClausUserNotFound
		}
		return nil, err
	}

	return &UserProfile{
		ID:             user.ID,
		Phone:          user.Phone,
		Email:          user.Email,
		DisplayName:    user.DisplayName,
		AvatarURL:      user.AvatarURL,
		QualityScore:   user.QualityScore,
		TotalEarned:    user.TotalEarned,
		PendingBalance: user.PendingBalance,
	}, nil
}

// UpdateProfileRequest contains fields that can be updated
type UpdateProfileRequest struct {
	DisplayName *string `json:"display_name,omitempty"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
	Email       *string `json:"email,omitempty"`
}

// UpdateProfile updates a user's profile
func (s *DataClausUserService) UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*UserProfile, error) {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, ErrDataClausUserNotFound
	}

	if req.DisplayName != nil {
		user.DisplayName = req.DisplayName
	}
	if req.AvatarURL != nil {
		user.AvatarURL = req.AvatarURL
	}
	if req.Email != nil {
		user.Email = req.Email
		user.EmailVerified = false // Require re-verification
	}

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update profile: %w", err)
	}

	return s.GetProfile(ctx, userID)
}

// ========================
// Earnings
// ========================

// DataClausUserEarnings represents a user's earnings summary
type DataClausUserEarnings struct {
	TotalEarned      float64 `json:"total_earned"`
	PendingBalance   float64 `json:"pending_balance"`
	AvailableBalance float64 `json:"available_balance"`
	QualityScore     float64 `json:"quality_score"`
}

// GetEarnings retrieves a user's earnings summary
func (s *DataClausUserService) GetEarnings(ctx context.Context, userID uuid.UUID) (*DataClausUserEarnings, error) {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, ErrDataClausUserNotFound
	}

	// Get wallet balance for available balance
	var availableBalance float64
	if s.walletService != nil && user.WalletID != uuid.Nil {
		wallet, err := s.walletService.Get(ctx, user.WalletID)
		if err == nil && wallet != nil {
			availableBalance = wallet.Balance
		}
	}

	return &DataClausUserEarnings{
		TotalEarned:      user.TotalEarned,
		PendingBalance:   user.PendingBalance,
		AvailableBalance: availableBalance,
		QualityScore:     user.QualityScore,
	}, nil
}

// ========================
// External User Linking
// ========================

// LinkExternalUserRequest contains the request to link an external user
type LinkExternalUserRequest struct {
	ApplicationID     uuid.UUID `json:"application_id"`
	ExternalUserID    string    `json:"external_user_id"`
	DeviceFingerprint string    `json:"device_fingerprint"`
}

// LinkExternalUserResponse contains the result of linking
type LinkExternalUserResponse struct {
	DataClausUserID uuid.UUID `json:"dataclaus_user_id"`
	WalletID        uuid.UUID `json:"wallet_id"`
	UserToken       string    `json:"user_token"`
	IsNewUser       bool      `json:"is_new_user"`
}

// LinkExternalUser links an external user ID to a DataClaus user
func (s *DataClausUserService) LinkExternalUser(ctx context.Context, dataclausUserID uuid.UUID, req LinkExternalUserRequest) (*LinkExternalUserResponse, error) {
	user, err := s.repo.GetByID(ctx, dataclausUserID)
	if err != nil {
		return nil, ErrDataClausUserNotFound
	}

	// Check if already linked
	existing, err := s.repo.GetLinkedExternalUser(ctx, req.ApplicationID, req.ExternalUserID)
	if err == nil && existing != nil {
		// Already linked, just return the info
		return &LinkExternalUserResponse{
			DataClausUserID: user.ID,
			WalletID:        user.WalletID,
			IsNewUser:       false,
		}, nil
	}

	// Create link
	link := &domain.LinkedExternalUser{
		ID:              uuid.New(),
		DataClausUserID: user.ID,
		ApplicationID:   req.ApplicationID,
		ExternalUserID:  req.ExternalUserID,
		CreatedAt:       time.Now(),
	}

	if err := s.repo.CreateLinkedExternalUser(ctx, link); err != nil {
		return nil, fmt.Errorf("failed to link external user: %w", err)
	}

	return &LinkExternalUserResponse{
		DataClausUserID: user.ID,
		WalletID:        user.WalletID,
		IsNewUser:       false,
	}, nil
}

// ========================
// Helper Functions
// ========================

// getOrCreateUser gets an existing user or creates a new one
func (s *DataClausUserService) getOrCreateUser(ctx context.Context, phone string) (*domain.DataClausUser, bool, error) {
	// Try to find existing user
	user, err := s.repo.GetByPhone(ctx, phone)
	if err == nil {
		return user, false, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}

	// Create new user
	userID := uuid.New()
	walletID := uuid.New()

	// Create wallet first
	if s.walletService != nil {
		wallet, err := s.walletService.Create(ctx, userID, "user", "USD")
		if err != nil {
			return nil, false, fmt.Errorf("failed to create wallet: %w", err)
		}
		walletID = wallet.ID
	}

	user = &domain.DataClausUser{
		ID:             userID,
		Phone:          phone,
		PhoneVerified:  false,
		WalletID:       walletID,
		QualityScore:   0.5,
		TotalEarned:    0,
		PendingBalance: 0,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.repo.Create(ctx, user); err != nil {
		return nil, false, fmt.Errorf("failed to create user: %w", err)
	}

	return user, true, nil
}

// createSession creates a new session with tokens
func (s *DataClausUserService) createSession(ctx context.Context, userID uuid.UUID) (string, string, error) {
	accessToken := generateToken()
	refreshToken := generateToken()

	session := &domain.DataClausUserSession{
		ID:           uuid.New(),
		UserID:       userID,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    time.Now().Add(TokenExpiryHours * time.Hour),
		CreatedAt:    time.Now(),
	}

	if err := s.repo.CreateSession(ctx, session); err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

// generateOTP generates a random numeric OTP
func generateOTP(length int) (string, error) {
	const digits = "0123456789"
	result := make([]byte, length)
	for i := range result {
		b := make([]byte, 1)
		if _, err := rand.Read(b); err != nil {
			return "", err
		}
		result[i] = digits[int(b[0])%len(digits)]
	}
	return string(result), nil
}

// hashOTP creates a SHA256 hash of an OTP
func hashOTP(otp string) string {
	hash := sha256.Sum256([]byte(otp))
	return hex.EncodeToString(hash[:])
}

// generateToken generates a random token string
func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}
