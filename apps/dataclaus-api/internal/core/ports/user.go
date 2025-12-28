package ports

import (
	"context"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
)

// UserRepository defines the interface for user persistence.
// This is a "driven" port.
type UserRepository interface {
	Save(ctx context.Context, user *domain.User) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
}

// UserService defines the interface for user business logic.
// This is a "driver" port.
type UserService interface {
	Create(ctx context.Context, email, name, password string) (*domain.User, error)
	Get(ctx context.Context, id uuid.UUID) (*domain.User, error)
	Authenticate(ctx context.Context, email, password string) (*domain.User, error)
}
