package http

import (
	"net/http"
	"time"

	"apps/dataclaus-api/internal/adapters/http/validation"
	"apps/dataclaus-api/internal/core/auth"
	"apps/dataclaus-api/internal/core/ports"
	"apps/dataclaus-api/internal/core/services"

	"github.com/labstack/echo/v4"
)

// AuthHandler handles HTTP requests for authentication operations.
type AuthHandler struct {
	userService      ports.UserService
	developerService ports.DeveloperService
	jwtManager       *auth.JWTManager
}

// NewAuthHandler creates a new instance of AuthHandler.
func NewAuthHandler(userService ports.UserService, developerService ports.DeveloperService, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		userService:      userService,
		developerService: developerService,
		jwtManager:       auth.NewJWTManager(jwtSecret, 24*time.Hour), // 24 hour token expiry
	}
}

// LoginRequest represents the request body for login.
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// LoginResponse represents the response body for login.
type LoginResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
	Token string `json:"token"`
}

// Login handles user authentication.
// It tries to authenticate as both user and developer.
func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest

	// Bind and validate the request
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	// Try to authenticate as a regular user first
	user, err := h.userService.Authenticate(c.Request().Context(), req.Email, req.Password)
	if err == nil && user != nil {
		// User authenticated successfully
		token, err := h.jwtManager.GenerateToken(user.ID, user.Email, "user")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to generate token",
			})
		}

		return c.JSON(http.StatusOK, LoginResponse{
			ID:    user.ID.String(),
			Email: user.Email,
			Name:  user.Name,
			Role:  "user",
			Token: token,
		})
	}

	// Try to authenticate as a developer
	developer, err := h.developerService.Authenticate(c.Request().Context(), req.Email, req.Password)
	if err == nil && developer != nil {
		// Developer authenticated successfully
		token, err := h.jwtManager.GenerateToken(developer.ID, developer.Email, "developer")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to generate token",
			})
		}

		return c.JSON(http.StatusOK, LoginResponse{
			ID:    developer.ID.String(),
			Email: developer.Email,
			Name:  developer.Name,
			Role:  "developer",
			Token: token,
		})
	}

	// Authentication failed for both user and developer
	if err != nil && err == services.ErrInvalidCredentials {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "invalid email or password",
		})
	}

	return c.JSON(http.StatusUnauthorized, map[string]string{
		"error": "invalid email or password",
	})
}
