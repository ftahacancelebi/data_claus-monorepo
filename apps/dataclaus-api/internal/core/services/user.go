package services

import (
	"context"
	"errors"
	"fmt"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
)

// UserService implements ports.UserService.
type UserService struct {
	repo ports.UserRepository
}

// NewUserService creates a new instance of UserService.
func NewUserService(repo ports.UserRepository) ports.UserService {
	return &UserService{repo: repo}
}

// Create creates a new user.
func (s *UserService) Create(ctx context.Context, email, name, password string) (*domain.User, error) {
	// Check if user already exists
	existingUser, err := s.repo.GetByEmail(ctx, email)
	if err == nil && existingUser != nil {
		return nil, errors.New("user with this email already exists")
	}

	// Create new user entity
	user := domain.NewUser(email, name, password)

	// Save to repository
	if err := s.repo.Save(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to save user: %w", err)
	}

	return user, nil
}

// Get retrieves a user by ID.
func (s *UserService) Get(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return user, nil
}
