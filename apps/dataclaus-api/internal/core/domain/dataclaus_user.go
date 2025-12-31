package domain

import (
	"time"

	"github.com/google/uuid"
)

// DataClausUser represents an end-user of the DataClaus platform.
// This is the SAME user across all developer apps AND the web portal.
// Users log in with their DataClaus credentials everywhere.
type DataClausUser struct {
	ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`

	// Authentication
	Phone         string  `gorm:"uniqueIndex;not null" json:"phone"`
	PhoneVerified bool    `gorm:"default:false" json:"phone_verified"`
	Email         *string `gorm:"uniqueIndex" json:"email,omitempty"`
	EmailVerified bool    `gorm:"default:false" json:"email_verified"`
	PasswordHash  *string `gorm:"-" json:"-"` // For web portal login

	// Profile
	DisplayName *string `json:"display_name,omitempty"`
	AvatarURL   *string `json:"avatar_url,omitempty"`

	// Financial
	WalletID uuid.UUID `gorm:"type:uuid" json:"wallet_id"`

	// Quality & Earnings
	QualityScore   float64 `gorm:"default:0.5" json:"quality_score"`
	TotalEarned    float64 `gorm:"default:0" json:"total_earned"`
	PendingBalance float64 `gorm:"default:0" json:"pending_balance"`

	// Metadata
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	LastActiveAt *time.Time `json:"last_active_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// TableName specifies the table name for GORM
func (DataClausUser) TableName() string {
	return "dataclaus_users"
}

// DeviceFingerprint stores device info for fraud detection and cross-app matching
type DeviceFingerprint struct {
	ID         uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	Hash       string    `gorm:"index" json:"hash"` // Hashed fingerprint for matching
	Platform   string    `json:"platform"`          // ios, android, web
	DeviceInfo string    `json:"device_info"`       // JSON with screen, OS, etc.
	LastSeenAt time.Time `json:"last_seen_at"`
	CreatedAt  time.Time `json:"created_at"`
}

// TableName specifies the table name for GORM
func (DeviceFingerprint) TableName() string {
	return "device_fingerprints"
}

// OTPCode stores pending OTP verifications
type OTPCode struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Phone     string    `gorm:"index;not null" json:"phone"`
	Code      string    `gorm:"not null" json:"-"` // Hashed OTP code
	ExpiresAt time.Time `json:"expires_at"`
	Used      bool      `gorm:"default:false" json:"used"`
	CreatedAt time.Time `json:"created_at"`
}

// TableName specifies the table name for GORM
func (OTPCode) TableName() string {
	return "otp_codes"
}

// IsExpired checks if the OTP has expired
func (o *OTPCode) IsExpired() bool {
	return time.Now().After(o.ExpiresAt)
}

// DataClausUserSession stores active user sessions for DataClaus platform users
// Named differently to avoid conflict with UserSession in models.go (which is for usage tracking)
type DataClausUserSession struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID       uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	AccessToken  string    `gorm:"uniqueIndex" json:"-"`       // The JWT token
	RefreshToken string    `gorm:"uniqueIndex" json:"-"`       // For token refresh
	DeviceInfo   string    `json:"device_info"`                // JSON: platform, fingerprint, etc.
	IPAddress    string    `json:"ip_address"`
	ExpiresAt    time.Time `json:"expires_at"`
	CreatedAt    time.Time `json:"created_at"`
}

// TableName specifies the table name for GORM
func (DataClausUserSession) TableName() string {
	return "dataclaus_user_sessions"
}

// IsExpired checks if the session has expired
func (s *DataClausUserSession) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// LinkedExternalUser tracks external user IDs linked to DataClaus users
// This allows matching developer's user IDs to DataClaus users
type LinkedExternalUser struct {
	ID              uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	DataClausUserID uuid.UUID `gorm:"type:uuid;index" json:"dataclaus_user_id"`
	ApplicationID   uuid.UUID `gorm:"type:uuid;index" json:"application_id"`
	ExternalUserID  string    `gorm:"index" json:"external_user_id"` // Developer's user ID
	CreatedAt       time.Time `json:"created_at"`
}

// TableName specifies the table name for GORM
func (LinkedExternalUser) TableName() string {
	return "linked_external_users"
}
