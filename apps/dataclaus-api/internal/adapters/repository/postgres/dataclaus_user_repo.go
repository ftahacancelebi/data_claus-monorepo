package postgres

import (
	"context"
	"time"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DataClausUserRepository handles database operations for DataClaus users
type DataClausUserRepository struct {
	db *gorm.DB
}

// NewDataClausUserRepository creates a new repository instance
func NewDataClausUserRepository(db *gorm.DB) *DataClausUserRepository {
	return &DataClausUserRepository{db: db}
}

// ========================
// User Operations
// ========================

// Create creates a new DataClaus user
func (r *DataClausUserRepository) Create(ctx context.Context, user *domain.DataClausUser) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// GetByID retrieves a user by their ID
func (r *DataClausUserRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.DataClausUser, error) {
	var user domain.DataClausUser
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByPhone retrieves a user by their phone number
func (r *DataClausUserRepository) GetByPhone(ctx context.Context, phone string) (*domain.DataClausUser, error) {
	var user domain.DataClausUser
	if err := r.db.WithContext(ctx).Where("phone = ?", phone).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByEmail retrieves a user by their email
func (r *DataClausUserRepository) GetByEmail(ctx context.Context, email string) (*domain.DataClausUser, error) {
	var user domain.DataClausUser
	if err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// Update updates a user record
func (r *DataClausUserRepository) Update(ctx context.Context, user *domain.DataClausUser) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// UpdateLastLogin updates the user's last login timestamp
func (r *DataClausUserRepository) UpdateLastLogin(ctx context.Context, userID uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&domain.DataClausUser{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"last_login_at":  now,
			"last_active_at": now,
		}).Error
}

// UpdateEarnings updates the user's earnings
func (r *DataClausUserRepository) UpdateEarnings(ctx context.Context, userID uuid.UUID, totalEarned, pendingBalance float64) error {
	return r.db.WithContext(ctx).Model(&domain.DataClausUser{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"total_earned":    totalEarned,
			"pending_balance": pendingBalance,
		}).Error
}

// UpdateQualityScore updates the user's quality score
func (r *DataClausUserRepository) UpdateQualityScore(ctx context.Context, userID uuid.UUID, score float64) error {
	return r.db.WithContext(ctx).Model(&domain.DataClausUser{}).
		Where("id = ?", userID).
		Update("quality_score", score).Error
}

// ========================
// OTP Operations
// ========================

// CreateOTP creates a new OTP code
func (r *DataClausUserRepository) CreateOTP(ctx context.Context, otp *domain.OTPCode) error {
	return r.db.WithContext(ctx).Create(otp).Error
}

// GetValidOTP retrieves a valid (unused, not expired) OTP for a phone number
func (r *DataClausUserRepository) GetValidOTP(ctx context.Context, phone, codeHash string) (*domain.OTPCode, error) {
	var otp domain.OTPCode
	if err := r.db.WithContext(ctx).
		Where("phone = ? AND code = ? AND used = ? AND expires_at > ?",
			phone, codeHash, false, time.Now()).
		Order("created_at DESC").
		First(&otp).Error; err != nil {
		return nil, err
	}
	return &otp, nil
}

// MarkOTPUsed marks an OTP as used
func (r *DataClausUserRepository) MarkOTPUsed(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&domain.OTPCode{}).
		Where("id = ?", id).
		Update("used", true).Error
}

// DeleteExpiredOTPs removes expired OTP codes
func (r *DataClausUserRepository) DeleteExpiredOTPs(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Where("expires_at < ? OR used = ?", time.Now(), true).
		Delete(&domain.OTPCode{}).Error
}

// ========================
// Session Operations
// ========================

// CreateSession creates a new user session
func (r *DataClausUserRepository) CreateSession(ctx context.Context, session *domain.DataClausUserSession) error {
	return r.db.WithContext(ctx).Create(session).Error
}

// GetSessionByAccessToken retrieves a session by access token
func (r *DataClausUserRepository) GetSessionByAccessToken(ctx context.Context, token string) (*domain.DataClausUserSession, error) {
	var session domain.DataClausUserSession
	if err := r.db.WithContext(ctx).
		Where("access_token = ? AND expires_at > ?", token, time.Now()).
		First(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

// GetSessionByRefreshToken retrieves a session by refresh token
func (r *DataClausUserRepository) GetSessionByRefreshToken(ctx context.Context, token string) (*domain.DataClausUserSession, error) {
	var session domain.DataClausUserSession
	if err := r.db.WithContext(ctx).
		Where("refresh_token = ?", token).
		First(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

// DeleteSession deletes a session by access token
func (r *DataClausUserRepository) DeleteSession(ctx context.Context, token string) error {
	return r.db.WithContext(ctx).
		Where("access_token = ?", token).
		Delete(&domain.DataClausUserSession{}).Error
}

// DeleteUserSessions deletes all sessions for a user
func (r *DataClausUserRepository) DeleteUserSessions(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Delete(&domain.DataClausUserSession{}).Error
}

// DeleteExpiredSessions removes expired sessions
func (r *DataClausUserRepository) DeleteExpiredSessions(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Where("expires_at < ?", time.Now()).
		Delete(&domain.DataClausUserSession{}).Error
}

// ========================
// Device Fingerprint Operations
// ========================

// CreateDeviceFingerprint creates a new device fingerprint
func (r *DataClausUserRepository) CreateDeviceFingerprint(ctx context.Context, fp *domain.DeviceFingerprint) error {
	return r.db.WithContext(ctx).Create(fp).Error
}

// GetDeviceFingerprintByHash finds a device fingerprint by its hash
func (r *DataClausUserRepository) GetDeviceFingerprintByHash(ctx context.Context, hash string) (*domain.DeviceFingerprint, error) {
	var fp domain.DeviceFingerprint
	if err := r.db.WithContext(ctx).
		Where("hash = ?", hash).
		First(&fp).Error; err != nil {
		return nil, err
	}
	return &fp, nil
}

// UpdateDeviceFingerprintLastSeen updates the last seen timestamp
func (r *DataClausUserRepository) UpdateDeviceFingerprintLastSeen(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&domain.DeviceFingerprint{}).
		Where("id = ?", id).
		Update("last_seen_at", time.Now()).Error
}

// ========================
// External User Linking Operations
// ========================

// CreateLinkedExternalUser creates a link between external user ID and DataClaus user
func (r *DataClausUserRepository) CreateLinkedExternalUser(ctx context.Context, link *domain.LinkedExternalUser) error {
	return r.db.WithContext(ctx).Create(link).Error
}

// GetLinkedExternalUser retrieves a link by application ID and external user ID
func (r *DataClausUserRepository) GetLinkedExternalUser(ctx context.Context, appID uuid.UUID, externalUserID string) (*domain.LinkedExternalUser, error) {
	var link domain.LinkedExternalUser
	if err := r.db.WithContext(ctx).
		Where("application_id = ? AND external_user_id = ?", appID, externalUserID).
		First(&link).Error; err != nil {
		return nil, err
	}
	return &link, nil
}

// GetLinkedExternalUsersByDataClausUser retrieves all external links for a DataClaus user
func (r *DataClausUserRepository) GetLinkedExternalUsersByDataClausUser(ctx context.Context, dataclausUserID uuid.UUID) ([]domain.LinkedExternalUser, error) {
	var links []domain.LinkedExternalUser
	if err := r.db.WithContext(ctx).
		Where("dataclaus_user_id = ?", dataclausUserID).
		Find(&links).Error; err != nil {
		return nil, err
	}
	return links, nil
}
