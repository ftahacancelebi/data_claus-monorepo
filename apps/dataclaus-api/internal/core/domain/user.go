package domain

import (
	"time"

	"github.com/google/uuid"
)

// User represents the user domain entity.
// It is a pure Go struct without any database tags.
type User struct {
	ID        uuid.UUID
	Email     string
	Name      string
	Password  string // In a real app, this should be a hashed password value object
	CreatedAt time.Time
	UpdatedAt time.Time
}

// NewUser creates a new User instance with a generated ID and timestamps.
func NewUser(email, name, password string) *User {
	now := time.Now().UTC()
	return &User{
		ID:        uuid.New(),
		Email:     email,
		Name:      name,
		Password:  password,
		CreatedAt: now,
		UpdatedAt: now,
	}
}
