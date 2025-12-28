package domain

import (
	"time"

	"github.com/google/uuid"
)

// Application represents a registered application belonging to a developer.
// Each application has its own API key for SDK authentication and data tracking.
type Application struct {
	ID          uuid.UUID
	DeveloperID uuid.UUID
	Name        string
	Description string
	Category    string
	WebsiteURL  string
	IsActive    bool

	// Statistics (updated by AI Worker)
	TotalEvents    int64
	TotalUsers     int64
	TotalRevenue   float64
	QualityScore   float64 // Average quality score (0-1)
	LastEventAt    *time.Time

	// Revenue settings
	UserSharePercent int // Override developer default (0 = use developer default)

	CreatedAt time.Time
	UpdatedAt time.Time
}

// NewApplication creates a new application with defaults.
func NewApplication(developerID uuid.UUID, name, description, category string) *Application {
	now := time.Now().UTC()
	return &Application{
		ID:          uuid.New(),
		DeveloperID: developerID,
		Name:        name,
		Description: description,
		Category:    category,
		IsActive:    true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// ApplicationStats holds aggregated statistics for an application.
type ApplicationStats struct {
	ApplicationID uuid.UUID
	TotalEvents   int64
	TotalUsers    int64
	TotalRevenue  float64
	AvgQuality    float64
	EventsToday   int64
	EventsWeek    int64
	EventsMonth   int64
}

// DeveloperWithApps includes developer info with their applications.
type DeveloperWithApps struct {
	Developer    Developer
	Applications []Application
	TotalApps    int
	ActiveApps   int
	TotalEvents  int64
	TotalRevenue float64
}
