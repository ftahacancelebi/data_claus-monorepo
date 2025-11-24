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

// UserGorm represents the database model for users.
type UserGorm struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;"`
	Email     string    `gorm:"uniqueIndex;not null"`
	Name      string    `gorm:"not null"`
	Password  string    `gorm:"not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

// TableName overrides the table name used by UserGorm to `users`.
func (UserGorm) TableName() string {
	return "users"
}

// UserRepository implements ports.UserRepository using GORM.
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new instance of UserRepository.
func NewUserRepository(db *gorm.DB) ports.UserRepository {
	return &UserRepository{db: db}
}

// Save persists a user to the database.
func (r *UserRepository) Save(ctx context.Context, user *domain.User) error {
	userGorm := toUserGorm(user)
	if err := r.db.WithContext(ctx).Save(userGorm).Error; err != nil {
		return err
	}
	return nil
}

// GetByID retrieves a user by ID.
func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var userGorm UserGorm
	if err := r.db.WithContext(ctx).First(&userGorm, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return toUserDomain(&userGorm), nil
}

// GetByEmail retrieves a user by email.
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var userGorm UserGorm
	if err := r.db.WithContext(ctx).First(&userGorm, "email = ?", email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return toUserDomain(&userGorm), nil
}

// Mappers

func toUserGorm(u *domain.User) *UserGorm {
	return &UserGorm{
		ID:        u.ID,
		Email:     u.Email,
		Name:      u.Name,
		Password:  u.Password,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
	}
}

func toUserDomain(u *UserGorm) *domain.User {
	return &domain.User{
		ID:        u.ID,
		Email:     u.Email,
		Name:      u.Name,
		Password:  u.Password,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
	}
}
