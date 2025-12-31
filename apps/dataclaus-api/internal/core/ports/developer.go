package ports

import (
	"context"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
)

type DeveloperRepository interface {
	Save(ctx context.Context, developer *domain.Developer) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Developer, error)
	GetByEmail(ctx context.Context, email string) (*domain.Developer, error)
	Update(ctx context.Context, developer *domain.Developer) error
}

type APIKeyRepository interface {
	Save(ctx context.Context, apiKey *domain.APIKey) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.APIKey, error)
	GetByKeyHash(ctx context.Context, keyHash string) (*domain.APIKey, error)
	GetByDeveloperID(ctx context.Context, developerID uuid.UUID) ([]*domain.APIKey, error)
	GetByApplicationID(ctx context.Context, applicationID uuid.UUID) ([]*domain.APIKey, error)
	Deactivate(ctx context.Context, id uuid.UUID) error
	UpdateLastUsed(ctx context.Context, id uuid.UUID) error
}

type DeveloperService interface {
	Register(ctx context.Context, name, email, password string) (*domain.Developer, error)
	Get(ctx context.Context, id uuid.UUID) (*domain.Developer, error)
	GetByEmail(ctx context.Context, email string) (*domain.Developer, error)
	UpdateUserShare(ctx context.Context, developerID uuid.UUID, userSharePercent int) (*domain.Developer, error)
	Authenticate(ctx context.Context, email, password string) (*domain.Developer, error)
}

type APIKeyService interface {
	Generate(ctx context.Context, developerID uuid.UUID, name string) (*domain.APIKey, string, error)
	GenerateForApplication(ctx context.Context, developerID, applicationID uuid.UUID, name string) (*domain.APIKey, string, error)
	GetByDeveloper(ctx context.Context, developerID uuid.UUID) ([]*domain.APIKey, error)
	GetByApplication(ctx context.Context, applicationID uuid.UUID) ([]*domain.APIKey, error)
	ValidateKey(ctx context.Context, rawKey string) (*domain.APIKey, error)
	Revoke(ctx context.Context, id uuid.UUID) error
}

