package http

import (
	"net/http"
	"strconv"

	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type AnalyticsHandler struct {
	service ports.AnalyticsService
}

func NewAnalyticsHandler(service ports.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{service: service}
}

type ScoredEventResponse struct {
	ID           string   `json:"id"`
	EventID      string   `json:"event_id"`
	DeveloperID  string   `json:"developer_id"`
	UserID       string   `json:"user_id"`
	QualityScore float64  `json:"quality_score"`
	IsHuman      bool     `json:"is_human"`
	Jitter       float64  `json:"jitter"`
	TimeVariance float64  `json:"time_variance"`
	CampaignID   *string  `json:"campaign_id,omitempty"`
	Payout       float64  `json:"payout"`
	ProcessedAt  string   `json:"processed_at"`
}

func (h *AnalyticsHandler) GetEvents(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	offset, _ := strconv.Atoi(c.QueryParam("offset"))

	events, err := h.service.GetEvents(c.Request().Context(), limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := make([]ScoredEventResponse, len(events))
	for i, e := range events {
		resp := ScoredEventResponse{
			ID:           e.ID.String(),
			EventID:      e.EventID,
			DeveloperID:  e.DeveloperID.String(),
			UserID:       e.UserID.String(),
			QualityScore: e.QualityScore,
			IsHuman:      e.IsHuman,
			Jitter:       e.Jitter,
			TimeVariance: e.TimeVariance,
			Payout:       e.Payout,
			ProcessedAt:  e.ProcessedAt.Format("2006-01-02T15:04:05Z"),
		}
		if e.CampaignID != nil {
			cid := e.CampaignID.String()
			resp.CampaignID = &cid
		}
		response[i] = resp
	}

	return c.JSON(http.StatusOK, response)
}

func (h *AnalyticsHandler) GetUserQualityScore(c echo.Context) error {
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid user id"})
	}

	score, err := h.service.GetUserQualityScore(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"user_id":       userID.String(),
		"quality_score": score,
	})
}

func (h *AnalyticsHandler) GetDashboard(c echo.Context) error {
	stats, err := h.service.GetDashboardStats(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, stats)
}
