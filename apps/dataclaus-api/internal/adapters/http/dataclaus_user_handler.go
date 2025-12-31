package http

import (
	"net/http"
	"strings"

	"apps/dataclaus-api/internal/adapters/http/validation"
	"apps/dataclaus-api/internal/core/services"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// DataClausUserHandler handles HTTP requests for DataClaus user operations
type DataClausUserHandler struct {
	service *services.DataClausUserService
}

// NewDataClausUserHandler creates a new handler instance
func NewDataClausUserHandler(service *services.DataClausUserService) *DataClausUserHandler {
	return &DataClausUserHandler{service: service}
}

// ========================
// Request/Response DTOs
// ========================

// RequestOTPRequest is the request body for requesting an OTP
type RequestOTPRequest struct {
	Phone          string `json:"phone" validate:"required"`
	RecaptchaToken string `json:"recaptcha_token,omitempty"`
}

// VerifyOTPRequest is the request body for verifying an OTP
type VerifyOTPRequest struct {
	Phone string `json:"phone" validate:"required"`
	Code  string `json:"code" validate:"required,len=6"`
}

// RefreshTokenRequest is the request body for refreshing tokens
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// VerifyTokenRequest is the request body for verifying an access token
type VerifyTokenRequest struct {
	Token string `json:"token" validate:"required"`
}

// UpdateProfileRequestDTO is the request body for updating profile
type UpdateProfileRequestDTO struct {
	DisplayName *string `json:"display_name,omitempty"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
	Email       *string `json:"email,omitempty" validate:"omitempty,email"`
}

// ========================
// OTP Authentication Handlers
// ========================

// RequestOTP handles POST /auth/user/request-otp
func (h *DataClausUserHandler) RequestOTP(c echo.Context) error {
	var req RequestOTPRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	// TODO: Verify reCAPTCHA token if provided
	// This would call the reCAPTCHA Enterprise API

	result, err := h.service.RequestOTP(c.Request().Context(), req.Phone)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, result)
}

// VerifyOTP handles POST /auth/user/verify-otp
func (h *DataClausUserHandler) VerifyOTP(c echo.Context) error {
	var req VerifyOTPRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	result, err := h.service.VerifyOTP(c.Request().Context(), req.Phone, req.Code)
	if err != nil {
		if err == services.ErrInvalidOTP {
			return c.JSON(http.StatusUnauthorized, map[string]string{
				"error": "Invalid or expired OTP",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, result)
}

// RefreshToken handles POST /auth/user/refresh
func (h *DataClausUserHandler) RefreshToken(c echo.Context) error {
	var req RefreshTokenRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	result, err := h.service.RefreshToken(c.Request().Context(), req.RefreshToken)
	if err != nil {
		if err == services.ErrInvalidUserToken {
			return c.JSON(http.StatusUnauthorized, map[string]string{
				"error": "Invalid or expired token",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, result)
}

// Logout handles POST /auth/user/logout
func (h *DataClausUserHandler) Logout(c echo.Context) error {
	token := extractBearerToken(c)
	if token == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Token required",
		})
	}

	err := h.service.Logout(c.Request().Context(), token)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Logged out successfully",
	})
}

// ========================
// Token Verification Handler
// ========================

// Verify handles POST /auth/user/verify - for SDK token verification
func (h *DataClausUserHandler) Verify(c echo.Context) error {
	var req VerifyTokenRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	user, err := h.service.ValidateToken(c.Request().Context(), req.Token)
	if err != nil {
		if err == services.ErrInvalidUserToken {
			return c.JSON(http.StatusUnauthorized, map[string]string{
				"error": "Invalid or expired token",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid":         true,
		"user_id":       user.ID.String(),
		"phone":         user.Phone,
		"email":         user.Email,
		"quality_score": user.QualityScore,
		"wallet_id":     user.WalletID.String(),
	})
}

// ========================
// Profile Handlers
// ========================

// GetMe handles GET /auth/user/me
func (h *DataClausUserHandler) GetMe(c echo.Context) error {
	userID, err := getDataClausUserIDFromContext(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Authentication required",
		})
	}

	profile, err := h.service.GetProfile(c.Request().Context(), userID)
	if err != nil {
		if err == services.ErrDataClausUserNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "User not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, profile)
}

// UpdateProfile handles PUT /auth/user/profile
func (h *DataClausUserHandler) UpdateProfile(c echo.Context) error {
	userID, err := getDataClausUserIDFromContext(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Authentication required",
		})
	}

	var req UpdateProfileRequestDTO
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	profile, err := h.service.UpdateProfile(c.Request().Context(), userID, services.UpdateProfileRequest{
		DisplayName: req.DisplayName,
		AvatarURL:   req.AvatarURL,
		Email:       req.Email,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, profile)
}

// ========================
// Earnings Handlers
// ========================

// GetEarnings handles GET /users/:userId/earnings
func (h *DataClausUserHandler) GetEarnings(c echo.Context) error {
	userIDParam := c.Param("userId")
	userID, err := uuid.Parse(userIDParam)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid user ID",
		})
	}

	earnings, err := h.service.GetEarnings(c.Request().Context(), userID)
	if err != nil {
		if err == services.ErrDataClausUserNotFound {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "User not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, earnings)
}

// ========================
// Middleware
// ========================

// UserAuthMiddleware validates the DataClaus user token and sets user in context
func (h *DataClausUserHandler) UserAuthMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			token := extractBearerToken(c)
			if token == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "Authorization required",
				})
			}

			user, err := h.service.ValidateToken(c.Request().Context(), token)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "Invalid or expired token",
				})
			}

			// Store user in context
			c.Set("dataclaus_user", user)
			c.Set("dataclaus_user_id", user.ID)

			return next(c)
		}
	}
}

// ========================
// Helper Functions
// ========================

// extractBearerToken extracts the Bearer token from Authorization header
func extractBearerToken(c echo.Context) string {
	auth := c.Request().Header.Get("Authorization")
	if auth == "" {
		return ""
	}

	parts := strings.SplitN(auth, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}

	return parts[1]
}

// getDataClausUserIDFromContext extracts user ID from context (set by middleware)
func getDataClausUserIDFromContext(c echo.Context) (uuid.UUID, error) {
	userID, ok := c.Get("dataclaus_user_id").(uuid.UUID)
	if !ok {
		return uuid.Nil, services.ErrInvalidUserToken
	}
	return userID, nil
}
