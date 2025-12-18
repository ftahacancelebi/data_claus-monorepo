package http

import (
	"net/http"

	"apps/dataclaus-api/internal/adapters/http/validation"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type DeveloperHandler struct {
	devService    ports.DeveloperService
	apiKeyService ports.APIKeyService
}

func NewDeveloperHandler(devService ports.DeveloperService, apiKeyService ports.APIKeyService) *DeveloperHandler {
	return &DeveloperHandler{
		devService:    devService,
		apiKeyService: apiKeyService,
	}
}

type RegisterDeveloperRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=100"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,strong_password"`
}

type DeveloperResponse struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Email            string `json:"email"`
	UserSharePercent int    `json:"user_share_percent"`
	DevSharePercent  int    `json:"dev_share_percent"`
}

type UpdateUserShareRequest struct {
	UserSharePercent int `json:"user_share_percent" validate:"required,min=50,max=90"`
}

type GenerateAPIKeyRequest struct {
	Name string `json:"name" validate:"required,min=1,max=100"`
}

type APIKeyResponse struct {
	ID        string  `json:"id"`
	KeyPrefix string  `json:"key_prefix"`
	Name      string  `json:"name"`
	IsActive  bool    `json:"is_active"`
	RawKey    *string `json:"raw_key,omitempty"`
}

func (h *DeveloperHandler) Register(c echo.Context) error {
	var req RegisterDeveloperRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	dev, err := h.devService.Register(c.Request().Context(), req.Name, req.Email, req.Password)
	if err != nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, DeveloperResponse{
		ID:               dev.ID.String(),
		Name:             dev.Name,
		Email:            dev.Email,
		UserSharePercent: dev.UserSharePercent,
		DevSharePercent:  dev.GetDeveloperSharePercent(),
	})
}

func (h *DeveloperHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid developer id"})
	}

	dev, err := h.devService.Get(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "developer not found"})
	}

	return c.JSON(http.StatusOK, DeveloperResponse{
		ID:               dev.ID.String(),
		Name:             dev.Name,
		Email:            dev.Email,
		UserSharePercent: dev.UserSharePercent,
		DevSharePercent:  dev.GetDeveloperSharePercent(),
	})
}

// UpdateUserShare allows developers to configure their user share percentage
// Higher user share = more attractive to users = better marketplace visibility
func (h *DeveloperHandler) UpdateUserShare(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid developer id"})
	}

	var req UpdateUserShareRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	dev, err := h.devService.UpdateUserShare(c.Request().Context(), id, req.UserSharePercent)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, DeveloperResponse{
		ID:               dev.ID.String(),
		Name:             dev.Name,
		Email:            dev.Email,
		UserSharePercent: dev.UserSharePercent,
		DevSharePercent:  dev.GetDeveloperSharePercent(),
	})
}

func (h *DeveloperHandler) GenerateAPIKey(c echo.Context) error {
	devID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid developer id"})
	}

	var req GenerateAPIKeyRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	apiKey, rawKey, err := h.apiKeyService.Generate(c.Request().Context(), devID, req.Name)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, APIKeyResponse{
		ID:        apiKey.ID.String(),
		KeyPrefix: apiKey.KeyPrefix,
		Name:      apiKey.Name,
		IsActive:  apiKey.IsActive,
		RawKey:    &rawKey,
	})
}

func (h *DeveloperHandler) ListAPIKeys(c echo.Context) error {
	devID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid developer id"})
	}

	keys, err := h.apiKeyService.GetByDeveloper(c.Request().Context(), devID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := make([]APIKeyResponse, len(keys))
	for i, k := range keys {
		response[i] = APIKeyResponse{
			ID:        k.ID.String(),
			KeyPrefix: k.KeyPrefix,
			Name:      k.Name,
			IsActive:  k.IsActive,
		}
	}

	return c.JSON(http.StatusOK, response)
}

func (h *DeveloperHandler) RevokeAPIKey(c echo.Context) error {
	keyID, err := uuid.Parse(c.Param("keyId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid key id"})
	}

	if err := h.apiKeyService.Revoke(c.Request().Context(), keyID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "revoked"})
}
