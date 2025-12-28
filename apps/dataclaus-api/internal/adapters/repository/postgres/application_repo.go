package postgres

import (
	"context"
	"time"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ApplicationModel is the GORM model for Application.
type ApplicationModel struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key"`
	DeveloperID      uuid.UUID `gorm:"type:uuid;not null;index"`
	Name             string    `gorm:"not null"`
	Description      string
	Category         string
	WebsiteURL       string
	IsActive         bool    `gorm:"default:true"`
	TotalEvents      int64   `gorm:"default:0"`
	TotalUsers       int64   `gorm:"default:0"`
	TotalRevenue     float64 `gorm:"default:0"`
	QualityScore     float64 `gorm:"default:0"`
	LastEventAt      *time.Time
	UserSharePercent int `gorm:"default:0"` // 0 = use developer default
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (ApplicationModel) TableName() string {
	return "applications"
}

// ApplicationRepository implements application data access.
type ApplicationRepository struct {
	db *gorm.DB
}

// NewApplicationRepository creates a new application repository.
func NewApplicationRepository(db *gorm.DB) *ApplicationRepository {
	// Auto-migrate the model
	db.AutoMigrate(&ApplicationModel{})
	return &ApplicationRepository{db: db}
}

// Create creates a new application.
func (r *ApplicationRepository) Create(ctx context.Context, app *domain.Application) error {
	model := &ApplicationModel{
		ID:               app.ID,
		DeveloperID:      app.DeveloperID,
		Name:             app.Name,
		Description:      app.Description,
		Category:         app.Category,
		WebsiteURL:       app.WebsiteURL,
		IsActive:         app.IsActive,
		UserSharePercent: app.UserSharePercent,
		CreatedAt:        app.CreatedAt,
		UpdatedAt:        app.UpdatedAt,
	}
	return r.db.WithContext(ctx).Create(model).Error
}

// GetByID gets an application by ID.
func (r *ApplicationRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Application, error) {
	var model ApplicationModel
	if err := r.db.WithContext(ctx).First(&model, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return modelToApplication(&model), nil
}

// GetByDeveloperID gets all applications for a developer.
func (r *ApplicationRepository) GetByDeveloperID(ctx context.Context, developerID uuid.UUID) ([]domain.Application, error) {
	var models []ApplicationModel
	if err := r.db.WithContext(ctx).Where("developer_id = ?", developerID).Order("created_at DESC").Find(&models).Error; err != nil {
		return nil, err
	}

	apps := make([]domain.Application, len(models))
	for i, m := range models {
		apps[i] = *modelToApplication(&m)
	}
	return apps, nil
}

// Update updates an application.
func (r *ApplicationRepository) Update(ctx context.Context, app *domain.Application) error {
	return r.db.WithContext(ctx).Model(&ApplicationModel{}).Where("id = ?", app.ID).Updates(map[string]interface{}{
		"name":         app.Name,
		"description":  app.Description,
		"category":     app.Category,
		"website_url":  app.WebsiteURL,
		"is_active":    app.IsActive,
		"updated_at":   time.Now().UTC(),
	}).Error
}

// UpdateStats updates application statistics (called by AI Worker).
func (r *ApplicationRepository) UpdateStats(ctx context.Context, appID uuid.UUID, events int64, users int64, revenue float64, quality float64) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&ApplicationModel{}).Where("id = ?", appID).Updates(map[string]interface{}{
		"total_events":  gorm.Expr("total_events + ?", events),
		"total_users":   gorm.Expr("total_users + ?", users),
		"total_revenue": gorm.Expr("total_revenue + ?", revenue),
		"quality_score": quality, // This should be a rolling average in production
		"last_event_at": &now,
		"updated_at":    now,
	}).Error
}

// IncrementEventCount increments the event count for an application.
func (r *ApplicationRepository) IncrementEventCount(ctx context.Context, appID uuid.UUID) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&ApplicationModel{}).Where("id = ?", appID).Updates(map[string]interface{}{
		"total_events":  gorm.Expr("total_events + 1"),
		"last_event_at": &now,
	}).Error
}

// Delete soft-deletes an application.
func (r *ApplicationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&ApplicationModel{}).Where("id = ?", id).Update("is_active", false).Error
}

// GetStats gets aggregated stats for an application.
func (r *ApplicationRepository) GetStats(ctx context.Context, appID uuid.UUID) (*domain.ApplicationStats, error) {
	var model ApplicationModel
	if err := r.db.WithContext(ctx).First(&model, "id = ?", appID).Error; err != nil {
		return nil, err
	}

	return &domain.ApplicationStats{
		ApplicationID: model.ID,
		TotalEvents:   model.TotalEvents,
		TotalUsers:    model.TotalUsers,
		TotalRevenue:  model.TotalRevenue,
		AvgQuality:    model.QualityScore,
	}, nil
}

func modelToApplication(m *ApplicationModel) *domain.Application {
	return &domain.Application{
		ID:               m.ID,
		DeveloperID:      m.DeveloperID,
		Name:             m.Name,
		Description:      m.Description,
		Category:         m.Category,
		WebsiteURL:       m.WebsiteURL,
		IsActive:         m.IsActive,
		TotalEvents:      m.TotalEvents,
		TotalUsers:       m.TotalUsers,
		TotalRevenue:     m.TotalRevenue,
		QualityScore:     m.QualityScore,
		LastEventAt:      m.LastEventAt,
		UserSharePercent: m.UserSharePercent,
		CreatedAt:        m.CreatedAt,
		UpdatedAt:        m.UpdatedAt,
	}
}
