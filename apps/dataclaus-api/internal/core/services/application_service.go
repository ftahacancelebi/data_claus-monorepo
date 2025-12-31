package services

import (
	"context"
	"fmt"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
)

// ApplicationRepository defines the interface for application data access.
type ApplicationRepository interface {
	Create(ctx context.Context, app *domain.Application) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Application, error)
	GetByDeveloperID(ctx context.Context, developerID uuid.UUID) ([]domain.Application, error)
	Update(ctx context.Context, app *domain.Application) error
	UpdateStats(ctx context.Context, appID uuid.UUID, events int64, users int64, revenue float64, quality float64) error
	IncrementEventCount(ctx context.Context, appID uuid.UUID) error
	Delete(ctx context.Context, id uuid.UUID) error
	GetStats(ctx context.Context, appID uuid.UUID) (*domain.ApplicationStats, error)
}

// ApplicationService handles application business logic.
type ApplicationService struct {
	repo ApplicationRepository
}

// NewApplicationService creates a new application service.
func NewApplicationService(repo ApplicationRepository) *ApplicationService {
	return &ApplicationService{repo: repo}
}

// CreateApplication creates a new application for a developer.
func (s *ApplicationService) CreateApplication(ctx context.Context, developerID uuid.UUID, name, description, category, websiteURL string) (*domain.Application, error) {
	if name == "" {
		return nil, fmt.Errorf("application name is required")
	}

	app := domain.NewApplication(developerID, name, description, category)
	app.WebsiteURL = websiteURL

	if err := s.repo.Create(ctx, app); err != nil {
		return nil, fmt.Errorf("failed to create application: %w", err)
	}

	return app, nil
}

// GetApplication gets an application by ID.
func (s *ApplicationService) GetApplication(ctx context.Context, id uuid.UUID) (*domain.Application, error) {
	return s.repo.GetByID(ctx, id)
}

// GetDeveloperApplications gets all applications for a developer.
func (s *ApplicationService) GetDeveloperApplications(ctx context.Context, developerID uuid.UUID) ([]domain.Application, error) {
	return s.repo.GetByDeveloperID(ctx, developerID)
}

// UpdateApplication updates an application.
func (s *ApplicationService) UpdateApplication(ctx context.Context, app *domain.Application) error {
	return s.repo.Update(ctx, app)
}

// UpdateApplicationStats updates application statistics (called after processing events).
func (s *ApplicationService) UpdateApplicationStats(ctx context.Context, appID uuid.UUID, events int64, users int64, revenue float64, quality float64) error {
	return s.repo.UpdateStats(ctx, appID, events, users, revenue, quality)
}

// IncrementEventCount increments event count for real-time tracking.
func (s *ApplicationService) IncrementEventCount(ctx context.Context, appID uuid.UUID) error {
	return s.repo.IncrementEventCount(ctx, appID)
}

// DeleteApplication soft-deletes an application.
func (s *ApplicationService) DeleteApplication(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

// GetApplicationStats gets statistics for an application.
func (s *ApplicationService) GetApplicationStats(ctx context.Context, appID uuid.UUID) (*domain.ApplicationStats, error) {
	return s.repo.GetStats(ctx, appID)
}

// ToggleApplicationStatus enables or disables an application.
func (s *ApplicationService) ToggleApplicationStatus(ctx context.Context, id uuid.UUID, isActive bool) error {
	app, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	app.IsActive = isActive
	return s.repo.Update(ctx, app)
}
