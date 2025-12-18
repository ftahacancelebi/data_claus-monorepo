package domain

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Developer struct {
	ID               uuid.UUID
	Name             string
	Email            string
	Password         string
	UserSharePercent int       // Percentage of earnings given to users (50-90%), developer gets remainder minus 5% platform fee
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type APIKey struct {
	ID          uuid.UUID
	DeveloperID uuid.UUID
	KeyHash     string
	KeyPrefix   string
	Name        string
	IsActive    bool
	LastUsedAt  *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func NewDeveloper(name, email, password string) *Developer {
	now := time.Now().UTC()
	return &Developer{
		ID:               uuid.New(),
		Name:             name,
		Email:            email,
		Password:         password,
		UserSharePercent: DefaultUserSharePercent, // Default 70% to users
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}

// SetUserSharePercent sets the user share percentage with validation
func (d *Developer) SetUserSharePercent(percent int) error {
	if percent < MinUserSharePercent || percent > MaxUserSharePercent {
		return fmt.Errorf("user share must be between %d%% and %d%%", MinUserSharePercent, MaxUserSharePercent)
	}
	d.UserSharePercent = percent
	d.UpdatedAt = time.Now().UTC()
	return nil
}

// GetDeveloperSharePercent calculates developer's share (100 - platform fee - user share)
func (d *Developer) GetDeveloperSharePercent() int {
	return 100 - PlatformFeePercent - d.UserSharePercent
}

func NewAPIKey(developerID uuid.UUID, name string) (*APIKey, string) {
	now := time.Now().UTC()
	rawKey := generateRandomKey(32)
	keyPrefix := rawKey[:8]

	return &APIKey{
		ID:          uuid.New(),
		DeveloperID: developerID,
		KeyHash:     rawKey,
		KeyPrefix:   keyPrefix,
		Name:        name,
		IsActive:    true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, rawKey
}

func generateRandomKey(length int) string {
	bytes := make([]byte, length)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
