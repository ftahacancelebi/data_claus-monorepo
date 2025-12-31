package http

import (
	"net/http"
	"time"

	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"
	"apps/dataclaus-api/internal/core/services"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// ApplicationHandler handles HTTP requests for applications.
type ApplicationHandler struct {
	service   *services.ApplicationService
	apiKeySvc ports.APIKeyService
}

// NewApplicationHandler creates a new application handler.
func NewApplicationHandler(service *services.ApplicationService, apiKeySvc ports.APIKeyService) *ApplicationHandler {
	return &ApplicationHandler{
		service:   service,
		apiKeySvc: apiKeySvc,
	}
}

// CreateApplicationRequest is the request body for creating an application.
type CreateApplicationRequest struct {
	Name        string `json:"name" validate:"required"`
	Description string `json:"description"`
	Category    string `json:"category"`
	WebsiteURL  string `json:"website_url"`
}

// ApplicationResponse is the response for an application.
type ApplicationResponse struct {
	ID           string  `json:"id"`
	DeveloperID  string  `json:"developer_id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	Category     string  `json:"category"`
	WebsiteURL   string  `json:"website_url"`
	IsActive     bool    `json:"is_active"`
	TotalEvents  int64   `json:"total_events"`
	TotalUsers   int64   `json:"total_users"`
	TotalRevenue float64 `json:"total_revenue"`
	QualityScore float64 `json:"quality_score"`
	APIKeyPrefix string  `json:"api_key_prefix,omitempty"`
	APIKey       string  `json:"api_key,omitempty"` // Only on create
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

// Create creates a new application and its API key.
func (h *ApplicationHandler) Create(c echo.Context) error {
	developerID := c.Param("developerId")
	devID, err := uuid.Parse(developerID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid developer ID"})
	}

	var req CreateApplicationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}

	// Create the application
	app, err := h.service.CreateApplication(c.Request().Context(), devID, req.Name, req.Description, req.Category, req.WebsiteURL)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Create an API key for this application
	apiKey, rawKey, err := h.apiKeySvc.GenerateForApplication(c.Request().Context(), devID, app.ID, req.Name+" Key")
	if err != nil {
		// Rollback app creation? For now just return partial success
		return c.JSON(http.StatusCreated, appToResponse(app, "", ""))
	}

	return c.JSON(http.StatusCreated, appToResponse(app, apiKey.KeyPrefix, rawKey))
}

// GetByDeveloper gets all applications for a developer.
func (h *ApplicationHandler) GetByDeveloper(c echo.Context) error {
	developerID := c.Param("developerId")
	devID, err := uuid.Parse(developerID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid developer ID"})
	}

	apps, err := h.service.GetDeveloperApplications(c.Request().Context(), devID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	responses := make([]ApplicationResponse, len(apps))
	for i, app := range apps {
		responses[i] = *appToResponse(&app, "", "")
	}

	return c.JSON(http.StatusOK, responses)
}

// Get gets an application by ID.
func (h *ApplicationHandler) Get(c echo.Context) error {
	appID := c.Param("id")
	id, err := uuid.Parse(appID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid application ID"})
	}

	app, err := h.service.GetApplication(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "application not found"})
	}

	return c.JSON(http.StatusOK, appToResponse(app, "", ""))
}

// GetStats gets statistics for an application.
func (h *ApplicationHandler) GetStats(c echo.Context) error {
	appID := c.Param("id")
	id, err := uuid.Parse(appID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid application ID"})
	}

	stats, err := h.service.GetApplicationStats(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "application not found"})
	}

	return c.JSON(http.StatusOK, stats)
}

// Update updates an application.
func (h *ApplicationHandler) Update(c echo.Context) error {
	appID := c.Param("id")
	id, err := uuid.Parse(appID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid application ID"})
	}

	var req CreateApplicationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	app, err := h.service.GetApplication(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "application not found"})
	}

	// Update fields
	if req.Name != "" {
		app.Name = req.Name
	}
	app.Description = req.Description
	app.Category = req.Category
	app.WebsiteURL = req.WebsiteURL
	app.UpdatedAt = time.Now().UTC()

	if err := h.service.UpdateApplication(c.Request().Context(), app); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, appToResponse(app, "", ""))
}

// ToggleStatus toggles the active status of an application.
func (h *ApplicationHandler) ToggleStatus(c echo.Context) error {
	appID := c.Param("id")
	id, err := uuid.Parse(appID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid application ID"})
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if err := h.service.ToggleApplicationStatus(c.Request().Context(), id, req.IsActive); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":    "updated",
		"is_active": req.IsActive,
	})
}

// Delete soft-deletes an application.
func (h *ApplicationHandler) Delete(c echo.Context) error {
	appID := c.Param("id")
	id, err := uuid.Parse(appID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid application ID"})
	}

	if err := h.service.DeleteApplication(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}

func appToResponse(app *domain.Application, keyPrefix, rawKey string) *ApplicationResponse {
	resp := &ApplicationResponse{
		ID:           app.ID.String(),
		DeveloperID:  app.DeveloperID.String(),
		Name:         app.Name,
		Description:  app.Description,
		Category:     app.Category,
		WebsiteURL:   app.WebsiteURL,
		IsActive:     app.IsActive,
		TotalEvents:  app.TotalEvents,
		TotalUsers:   app.TotalUsers,
		TotalRevenue: app.TotalRevenue,
		QualityScore: app.QualityScore,
		CreatedAt:    app.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    app.UpdatedAt.Format(time.RFC3339),
	}
	if keyPrefix != "" {
		resp.APIKeyPrefix = keyPrefix
	}
	if rawKey != "" {
		resp.APIKey = rawKey
	}
	return resp
}
