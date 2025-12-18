package services

import (
	"context"
	"errors"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type DeveloperService struct {
	repo ports.DeveloperRepository
}

func NewDeveloperService(repo ports.DeveloperRepository) ports.DeveloperService {
	return &DeveloperService{repo: repo}
}

func (s *DeveloperService) Register(ctx context.Context, name, email, password string) (*domain.Developer, error) {
	existing, _ := s.repo.GetByEmail(ctx, email)
	if existing != nil {
		return nil, errors.New("developer with this email already exists")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	developer := domain.NewDeveloper(name, email, string(hashedPassword))

	if err := s.repo.Save(ctx, developer); err != nil {
		return nil, err
	}

	return developer, nil
}

func (s *DeveloperService) Get(ctx context.Context, id uuid.UUID) (*domain.Developer, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *DeveloperService) GetByEmail(ctx context.Context, email string) (*domain.Developer, error) {
	return s.repo.GetByEmail(ctx, email)
}

func (s *DeveloperService) UpdateUserShare(ctx context.Context, developerID uuid.UUID, userSharePercent int) (*domain.Developer, error) {
	developer, err := s.repo.GetByID(ctx, developerID)
	if err != nil {
		return nil, err
	}

	if err := developer.SetUserSharePercent(userSharePercent); err != nil {
		return nil, err
	}

	if err := s.repo.Update(ctx, developer); err != nil {
		return nil, err
	}

	return developer, nil
}

type APIKeyService struct {
	repo    ports.APIKeyRepository
	devRepo ports.DeveloperRepository
}

func NewAPIKeyService(repo ports.APIKeyRepository, devRepo ports.DeveloperRepository) ports.APIKeyService {
	return &APIKeyService{repo: repo, devRepo: devRepo}
}

func (s *APIKeyService) Generate(ctx context.Context, developerID uuid.UUID, name string) (*domain.APIKey, string, error) {
	_, err := s.devRepo.GetByID(ctx, developerID)
	if err != nil {
		return nil, "", errors.New("developer not found")
	}

	apiKey, rawKey := domain.NewAPIKey(developerID, name)

	if err := s.repo.Save(ctx, apiKey); err != nil {
		return nil, "", err
	}

	return apiKey, rawKey, nil
}

func (s *APIKeyService) GetByDeveloper(ctx context.Context, developerID uuid.UUID) ([]*domain.APIKey, error) {
	return s.repo.GetByDeveloperID(ctx, developerID)
}

func (s *APIKeyService) ValidateKey(ctx context.Context, rawKey string) (*domain.APIKey, error) {
	apiKey, err := s.repo.GetByKeyHash(ctx, rawKey)
	if err != nil {
		return nil, errors.New("invalid API key")
	}

	if !apiKey.IsActive {
		return nil, errors.New("API key is deactivated")
	}

	_ = s.repo.UpdateLastUsed(ctx, apiKey.ID)

	return apiKey, nil
}

func (s *APIKeyService) Revoke(ctx context.Context, id uuid.UUID) error {
	return s.repo.Deactivate(ctx, id)
}
