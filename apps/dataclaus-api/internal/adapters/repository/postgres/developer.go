package postgres

import (
	"context"
	"errors"
	"time"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DeveloperRepository struct {
	db *gorm.DB
}

func NewDeveloperRepository(db *gorm.DB) ports.DeveloperRepository {
	return &DeveloperRepository{db: db}
}

func (r *DeveloperRepository) Save(ctx context.Context, developer *domain.Developer) error {
	gormDev := toDeveloperGorm(developer)
	return r.db.WithContext(ctx).Create(gormDev).Error
}

func (r *DeveloperRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Developer, error) {
	var gormDev DeveloperGorm
	if err := r.db.WithContext(ctx).First(&gormDev, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("developer not found")
		}
		return nil, err
	}
	return toDeveloperDomain(&gormDev), nil
}

func (r *DeveloperRepository) GetByEmail(ctx context.Context, email string) (*domain.Developer, error) {
	var gormDev DeveloperGorm
	if err := r.db.WithContext(ctx).First(&gormDev, "email = ?", email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("developer not found")
		}
		return nil, err
	}
	return toDeveloperDomain(&gormDev), nil
}

func (r *DeveloperRepository) Update(ctx context.Context, developer *domain.Developer) error {
	gormDev := toDeveloperGorm(developer)
	return r.db.WithContext(ctx).Save(gormDev).Error
}

func toDeveloperGorm(d *domain.Developer) *DeveloperGorm {
	return &DeveloperGorm{
		ID:               d.ID,
		Name:             d.Name,
		Email:            d.Email,
		Password:         d.Password,
		UserSharePercent: d.UserSharePercent,
		CreatedAt:        d.CreatedAt,
		UpdatedAt:        d.UpdatedAt,
	}
}

func toDeveloperDomain(d *DeveloperGorm) *domain.Developer {
	return &domain.Developer{
		ID:               d.ID,
		Name:             d.Name,
		Email:            d.Email,
		Password:         d.Password,
		UserSharePercent: d.UserSharePercent,
		CreatedAt:        d.CreatedAt,
		UpdatedAt:        d.UpdatedAt,
	}
}

type APIKeyRepository struct {
	db *gorm.DB
}

func NewAPIKeyRepository(db *gorm.DB) ports.APIKeyRepository {
	return &APIKeyRepository{db: db}
}

func (r *APIKeyRepository) Save(ctx context.Context, apiKey *domain.APIKey) error {
	gormKey := toAPIKeyGorm(apiKey)
	return r.db.WithContext(ctx).Create(gormKey).Error
}

func (r *APIKeyRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.APIKey, error) {
	var gormKey APIKeyGorm
	if err := r.db.WithContext(ctx).First(&gormKey, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("API key not found")
		}
		return nil, err
	}
	return toAPIKeyDomain(&gormKey), nil
}

func (r *APIKeyRepository) GetByKeyHash(ctx context.Context, keyHash string) (*domain.APIKey, error) {
	var gormKey APIKeyGorm
	if err := r.db.WithContext(ctx).First(&gormKey, "key_hash = ?", keyHash).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("API key not found")
		}
		return nil, err
	}
	return toAPIKeyDomain(&gormKey), nil
}

func (r *APIKeyRepository) GetByDeveloperID(ctx context.Context, developerID uuid.UUID) ([]*domain.APIKey, error) {
	var gormKeys []APIKeyGorm
	if err := r.db.WithContext(ctx).Where("developer_id = ?", developerID).Find(&gormKeys).Error; err != nil {
		return nil, err
	}

	keys := make([]*domain.APIKey, len(gormKeys))
	for i, gk := range gormKeys {
		keys[i] = toAPIKeyDomain(&gk)
	}
	return keys, nil
}

func (r *APIKeyRepository) GetByApplicationID(ctx context.Context, applicationID uuid.UUID) ([]*domain.APIKey, error) {
	var gormKeys []APIKeyGorm
	if err := r.db.WithContext(ctx).Where("application_id = ?", applicationID).Find(&gormKeys).Error; err != nil {
		return nil, err
	}

	keys := make([]*domain.APIKey, len(gormKeys))
	for i, gk := range gormKeys {
		keys[i] = toAPIKeyDomain(&gk)
	}
	return keys, nil
}

func (r *APIKeyRepository) Deactivate(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&APIKeyGorm{}).Where("id = ?", id).
		Update("is_active", false).Error
}

func (r *APIKeyRepository) UpdateLastUsed(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&APIKeyGorm{}).Where("id = ?", id).
		Update("last_used_at", now).Error
}

func toAPIKeyGorm(k *domain.APIKey) *APIKeyGorm {
	return &APIKeyGorm{
		ID:            k.ID,
		DeveloperID:   k.DeveloperID,
		ApplicationID: k.ApplicationID,
		KeyHash:       k.KeyHash,
		KeyPrefix:     k.KeyPrefix,
		Name:          k.Name,
		IsActive:      k.IsActive,
		LastUsedAt:    k.LastUsedAt,
		CreatedAt:     k.CreatedAt,
		UpdatedAt:     k.UpdatedAt,
	}
}

func toAPIKeyDomain(k *APIKeyGorm) *domain.APIKey {
	return &domain.APIKey{
		ID:            k.ID,
		DeveloperID:   k.DeveloperID,
		ApplicationID: k.ApplicationID,
		KeyHash:       k.KeyHash,
		KeyPrefix:     k.KeyPrefix,
		Name:          k.Name,
		IsActive:      k.IsActive,
		LastUsedAt:    k.LastUsedAt,
		CreatedAt:     k.CreatedAt,
		UpdatedAt:     k.UpdatedAt,
	}
}

