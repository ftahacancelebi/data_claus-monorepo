package http

import (
	"net/http"

	"apps/dataclaus-api/internal/adapters/http/validation"
	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/services"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// AdsHandler handles HTTP requests for ad operations
type AdsHandler struct {
	service *services.AdsService
}

// NewAdsHandler creates a new handler instance
func NewAdsHandler(service *services.AdsService) *AdsHandler {
	return &AdsHandler{service: service}
}

// ========================
// Request/Response DTOs
// ========================

// RecordImpressionDTO is the request body for recording an ad impression
type RecordImpressionDTO struct {
	UserID       string  `json:"user_id" validate:"required,uuid"`
	AdType       string  `json:"ad_type" validate:"required,oneof=banner interstitial rewarded"`
	GrossRevenue float64 `json:"gross_revenue,omitempty"`
	AdUnitID     string  `json:"ad_unit_id,omitempty"`
	SessionID    string  `json:"session_id,omitempty"`
	IPAddress    string  `json:"ip_address,omitempty"`
	DeviceInfo   string  `json:"device_info,omitempty"`
	CountryCode  string  `json:"country_code,omitempty"`
}

// ========================
// Handlers
// ========================

// RecordImpression handles POST /applications/:appId/ads/impression
func (h *AdsHandler) RecordImpression(c echo.Context) error {
	appIDParam := c.Param("appId")
	appID, err := uuid.Parse(appIDParam)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid application ID",
		})
	}

	var dto RecordImpressionDTO
	if err := validation.ValidateDTO(c, &dto); err != nil {
		return err
	}

	userID, err := uuid.Parse(dto.UserID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid user ID",
		})
	}

	var sessionID *uuid.UUID
	if dto.SessionID != "" {
		sid, err := uuid.Parse(dto.SessionID)
		if err == nil {
			sessionID = &sid
		}
	}

	result, err := h.service.RecordImpression(c.Request().Context(), services.RecordImpressionRequest{
		ApplicationID: appID,
		UserID:        userID,
		AdType:        domain.AdType(dto.AdType),
		GrossRevenue:  dto.GrossRevenue,
		AdUnitID:      dto.AdUnitID,
		SessionID:     sessionID,
		IPAddress:     dto.IPAddress,
		DeviceInfo:    dto.DeviceInfo,
		CountryCode:   dto.CountryCode,
	})

	if err != nil {
		switch err {
		case services.ErrInvalidAdType:
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Invalid ad type. Must be banner, interstitial, or rewarded",
			})
		case services.ErrApplicationNotFound:
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Application not found",
			})
		case services.ErrDailyLimitReached:
			return c.JSON(http.StatusTooManyRequests, map[string]string{
				"error": "Daily impression limit reached for this ad type",
			})
		default:
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": err.Error(),
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":        true,
		"impression_id":  result.ImpressionID.String(),
		"gross_revenue":  result.GrossRevenue,
		"user_share":     result.UserShare,
		"dev_share":      result.DevShare,
		"platform_fee":   result.PlatformFee,
		"user_new_total": result.UserNewTotal,
		"distributed":    result.Distributed,
	})
}

// GetAdConfig handles GET /applications/:appId/ads/config
func (h *AdsHandler) GetAdConfig(c echo.Context) error {
	appIDParam := c.Param("appId")
	appID, err := uuid.Parse(appIDParam)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid application ID",
		})
	}

	config, err := h.service.GetAdConfig(c.Request().Context(), appID)
	if err != nil {
		if err == services.ErrApplicationNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Application not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, config)
}

// GetApplicationRevenueSummary handles GET /applications/:appId/ads/summary
func (h *AdsHandler) GetApplicationRevenueSummary(c echo.Context) error {
	appIDParam := c.Param("appId")
	appID, err := uuid.Parse(appIDParam)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid application ID",
		})
	}

	period := c.QueryParam("period")
	if period == "" {
		period = "month"
	}

	summary, err := h.service.GetApplicationRevenueSummary(c.Request().Context(), appID, period)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, summary)
}

// GetUserRevenueSummary handles GET /users/:userId/ads/summary
func (h *AdsHandler) GetUserRevenueSummary(c echo.Context) error {
	userIDParam := c.Param("userId")
	userID, err := uuid.Parse(userIDParam)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid user ID",
		})
	}

	period := c.QueryParam("period")
	if period == "" {
		period = "month"
	}

	summary, err := h.service.GetUserRevenueSummary(c.Request().Context(), userID, period)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, summary)
}

// GetDeveloperRevenueSummary handles GET /developers/:developerId/ads/summary
func (h *AdsHandler) GetDeveloperRevenueSummary(c echo.Context) error {
	devIDParam := c.Param("developerId")
	devID, err := uuid.Parse(devIDParam)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid developer ID",
		})
	}

	period := c.QueryParam("period")
	if period == "" {
		period = "month"
	}

	summary, err := h.service.GetDeveloperRevenueSummary(c.Request().Context(), devID, period)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, summary)
}

// GetAdRates handles GET /ads/rates - public endpoint showing earnings per impression
func (h *AdsHandler) GetAdRates(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"banner": map[string]interface{}{
			"ecpm":           domain.GetEcpmByAdType(domain.AdTypeBanner),
			"per_impression": domain.GetRevenuePerImpression(domain.AdTypeBanner),
		},
		"interstitial": map[string]interface{}{
			"ecpm":           domain.GetEcpmByAdType(domain.AdTypeInterstitial),
			"per_impression": domain.GetRevenuePerImpression(domain.AdTypeInterstitial),
		},
		"rewarded": map[string]interface{}{
			"ecpm":           domain.GetEcpmByAdType(domain.AdTypeRewarded),
			"per_impression": domain.GetRevenuePerImpression(domain.AdTypeRewarded),
		},
		"currency":            "USD",
		"platform_fee_percent": domain.PlatformFeePercent,
		"default_user_share":   domain.DefaultUserSharePercent,
	})
}
