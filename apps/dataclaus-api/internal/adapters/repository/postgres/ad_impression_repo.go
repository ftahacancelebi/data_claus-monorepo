package postgres

import (
	"context"
	"time"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AdImpressionRepository handles database operations for ad impressions
type AdImpressionRepository struct {
	db *gorm.DB
}

// NewAdImpressionRepository creates a new repository instance
func NewAdImpressionRepository(db *gorm.DB) *AdImpressionRepository {
	return &AdImpressionRepository{db: db}
}

// Create creates a new ad impression record
func (r *AdImpressionRepository) Create(ctx context.Context, impression *domain.AdImpression) error {
	return r.db.WithContext(ctx).Create(impression).Error
}

// GetByID retrieves an ad impression by ID
func (r *AdImpressionRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.AdImpression, error) {
	var impression domain.AdImpression
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&impression).Error; err != nil {
		return nil, err
	}
	return &impression, nil
}

// GetByUserID retrieves ad impressions for a user
func (r *AdImpressionRepository) GetByUserID(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.AdImpression, error) {
	var impressions []domain.AdImpression
	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&impressions).Error; err != nil {
		return nil, err
	}
	return impressions, nil
}

// GetByApplicationID retrieves ad impressions for an application
func (r *AdImpressionRepository) GetByApplicationID(ctx context.Context, appID uuid.UUID, limit, offset int) ([]domain.AdImpression, error) {
	var impressions []domain.AdImpression
	if err := r.db.WithContext(ctx).
		Where("application_id = ?", appID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&impressions).Error; err != nil {
		return nil, err
	}
	return impressions, nil
}

// GetByDeveloperID retrieves ad impressions for a developer
func (r *AdImpressionRepository) GetByDeveloperID(ctx context.Context, devID uuid.UUID, limit, offset int) ([]domain.AdImpression, error) {
	var impressions []domain.AdImpression
	if err := r.db.WithContext(ctx).
		Where("developer_id = ?", devID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&impressions).Error; err != nil {
		return nil, err
	}
	return impressions, nil
}

// GetUndistributed retrieves impressions that haven't been distributed yet
func (r *AdImpressionRepository) GetUndistributed(ctx context.Context, limit int) ([]domain.AdImpression, error) {
	var impressions []domain.AdImpression
	if err := r.db.WithContext(ctx).
		Where("distributed = ?", false).
		Order("created_at ASC").
		Limit(limit).
		Find(&impressions).Error; err != nil {
		return nil, err
	}
	return impressions, nil
}

// MarkDistributed marks an impression as distributed
func (r *AdImpressionRepository) MarkDistributed(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&domain.AdImpression{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"distributed":    true,
			"distributed_at": now,
		}).Error
}

// GetUserSummary gets revenue summary for a user within a time period
func (r *AdImpressionRepository) GetUserSummary(ctx context.Context, userID uuid.UUID, startTime, endTime time.Time) (*domain.AdRevenueSummary, error) {
	var summary domain.AdRevenueSummary

	err := r.db.WithContext(ctx).Model(&domain.AdImpression{}).
		Select(`
			COUNT(*) as total_impressions,
			COALESCE(SUM(gross_revenue), 0) as total_gross_revenue,
			COALESCE(SUM(user_share), 0) as total_user_share,
			COALESCE(SUM(dev_share), 0) as total_dev_share,
			COALESCE(SUM(platform_fee), 0) as total_platform_fee,
			COUNT(CASE WHEN ad_type = 'banner' THEN 1 END) as banner_impressions,
			COUNT(CASE WHEN ad_type = 'interstitial' THEN 1 END) as interstitial_count,
			COUNT(CASE WHEN ad_type = 'rewarded' THEN 1 END) as rewarded_count
		`).
		Where("user_id = ? AND created_at BETWEEN ? AND ?", userID, startTime, endTime).
		Scan(&summary).Error

	if err != nil {
		return nil, err
	}

	// Calculate average eCPM
	if summary.TotalImpressions > 0 {
		summary.AverageEcpm = (summary.TotalGrossRevenue / float64(summary.TotalImpressions)) * 1000
	}

	return &summary, nil
}

// GetApplicationSummary gets revenue summary for an application within a time period
func (r *AdImpressionRepository) GetApplicationSummary(ctx context.Context, appID uuid.UUID, startTime, endTime time.Time) (*domain.AdRevenueSummary, error) {
	var summary domain.AdRevenueSummary

	err := r.db.WithContext(ctx).Model(&domain.AdImpression{}).
		Select(`
			COUNT(*) as total_impressions,
			COALESCE(SUM(gross_revenue), 0) as total_gross_revenue,
			COALESCE(SUM(user_share), 0) as total_user_share,
			COALESCE(SUM(dev_share), 0) as total_dev_share,
			COALESCE(SUM(platform_fee), 0) as total_platform_fee,
			COUNT(CASE WHEN ad_type = 'banner' THEN 1 END) as banner_impressions,
			COUNT(CASE WHEN ad_type = 'interstitial' THEN 1 END) as interstitial_count,
			COUNT(CASE WHEN ad_type = 'rewarded' THEN 1 END) as rewarded_count
		`).
		Where("application_id = ? AND created_at BETWEEN ? AND ?", appID, startTime, endTime).
		Scan(&summary).Error

	if err != nil {
		return nil, err
	}

	// Calculate average eCPM
	if summary.TotalImpressions > 0 {
		summary.AverageEcpm = (summary.TotalGrossRevenue / float64(summary.TotalImpressions)) * 1000
	}

	return &summary, nil
}

// GetDeveloperSummary gets revenue summary for a developer within a time period
func (r *AdImpressionRepository) GetDeveloperSummary(ctx context.Context, devID uuid.UUID, startTime, endTime time.Time) (*domain.AdRevenueSummary, error) {
	var summary domain.AdRevenueSummary

	err := r.db.WithContext(ctx).Model(&domain.AdImpression{}).
		Select(`
			COUNT(*) as total_impressions,
			COALESCE(SUM(gross_revenue), 0) as total_gross_revenue,
			COALESCE(SUM(user_share), 0) as total_user_share,
			COALESCE(SUM(dev_share), 0) as total_dev_share,
			COALESCE(SUM(platform_fee), 0) as total_platform_fee,
			COUNT(CASE WHEN ad_type = 'banner' THEN 1 END) as banner_impressions,
			COUNT(CASE WHEN ad_type = 'interstitial' THEN 1 END) as interstitial_count,
			COUNT(CASE WHEN ad_type = 'rewarded' THEN 1 END) as rewarded_count
		`).
		Where("developer_id = ? AND created_at BETWEEN ? AND ?", devID, startTime, endTime).
		Scan(&summary).Error

	if err != nil {
		return nil, err
	}

	// Calculate average eCPM
	if summary.TotalImpressions > 0 {
		summary.AverageEcpm = (summary.TotalGrossRevenue / float64(summary.TotalImpressions)) * 1000
	}

	return &summary, nil
}

// GetPlatformSummary gets total platform revenue within a time period
func (r *AdImpressionRepository) GetPlatformSummary(ctx context.Context, startTime, endTime time.Time) (*domain.AdRevenueSummary, error) {
	var summary domain.AdRevenueSummary

	err := r.db.WithContext(ctx).Model(&domain.AdImpression{}).
		Select(`
			COUNT(*) as total_impressions,
			COALESCE(SUM(gross_revenue), 0) as total_gross_revenue,
			COALESCE(SUM(user_share), 0) as total_user_share,
			COALESCE(SUM(dev_share), 0) as total_dev_share,
			COALESCE(SUM(platform_fee), 0) as total_platform_fee,
			COUNT(CASE WHEN ad_type = 'banner' THEN 1 END) as banner_impressions,
			COUNT(CASE WHEN ad_type = 'interstitial' THEN 1 END) as interstitial_count,
			COUNT(CASE WHEN ad_type = 'rewarded' THEN 1 END) as rewarded_count
		`).
		Where("created_at BETWEEN ? AND ?", startTime, endTime).
		Scan(&summary).Error

	if err != nil {
		return nil, err
	}

	// Calculate average eCPM
	if summary.TotalImpressions > 0 {
		summary.AverageEcpm = (summary.TotalGrossRevenue / float64(summary.TotalImpressions)) * 1000
	}

	return &summary, nil
}

// CountByUserToday counts impressions for a user today (for rate limiting)
func (r *AdImpressionRepository) CountByUserToday(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	today := time.Now().Truncate(24 * time.Hour)
	tomorrow := today.Add(24 * time.Hour)

	if err := r.db.WithContext(ctx).Model(&domain.AdImpression{}).
		Where("user_id = ? AND created_at >= ? AND created_at < ?", userID, today, tomorrow).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// CountByUserAndTypeToday counts impressions for a user by type today
func (r *AdImpressionRepository) CountByUserAndTypeToday(ctx context.Context, userID uuid.UUID, adType domain.AdType) (int64, error) {
	var count int64
	today := time.Now().Truncate(24 * time.Hour)
	tomorrow := today.Add(24 * time.Hour)

	if err := r.db.WithContext(ctx).Model(&domain.AdImpression{}).
		Where("user_id = ? AND ad_type = ? AND created_at >= ? AND created_at < ?", userID, adType, today, tomorrow).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
