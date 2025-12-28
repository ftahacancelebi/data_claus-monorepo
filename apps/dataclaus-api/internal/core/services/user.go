package services

import (
	"context"
	"errors"
	"fmt"

	"apps/dataclaus-api/internal/core/auth"
	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
)

var (
	// ErrUserNotFound is returned when user is not found
	ErrUserNotFound = errors.New("user not found")
	// ErrInvalidCredentials is returned when credentials are invalid
	ErrInvalidCredentials = errors.New("invalid credentials")
)

// UserService implements ports.UserService.
type UserService struct {
	repo ports.UserRepository
}

// NewUserService creates a new instance of UserService.
func NewUserService(repo ports.UserRepository) ports.UserService {
	return &UserService{repo: repo}
}

// Create creates a new user with hashed password.
func (s *UserService) Create(ctx context.Context, email, name, password string) (*domain.User, error) {
	// Check if user already exists
	existingUser, err := s.repo.GetByEmail(ctx, email)
	if err == nil && existingUser != nil {
		return nil, errors.New("user with this email already exists")
	}

	// Hash the password
	hashedPassword, err := auth.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create new user entity with hashed password
	user := domain.NewUser(email, name, hashedPassword)

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

// Authenticate verifies user credentials and returns the user if valid.
func (s *UserService) Authenticate(ctx context.Context, email, password string) (*domain.User, error) {
	// Get user by email
	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil || user == nil {
		return nil, ErrInvalidCredentials
	}

	// Verify password
	if err := auth.VerifyPassword(user.Password, password); err != nil {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}

