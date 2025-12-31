package http

import (
	"net/http"

	"apps/dataclaus-api/internal/adapters/http/validation"
	"apps/dataclaus-api/internal/core/services"

	"github.com/labstack/echo/v4"
)

// RecaptchaHandler handles HTTP requests for reCAPTCHA operations
type RecaptchaHandler struct {
	service *services.RecaptchaService
}

// NewRecaptchaHandler creates a new handler instance
func NewRecaptchaHandler(service *services.RecaptchaService) *RecaptchaHandler {
	return &RecaptchaHandler{service: service}
}

// ========================
// Request/Response DTOs
// ========================

// VerifyRecaptchaDTO is the request body for verifying a reCAPTCHA token
type VerifyRecaptchaDTO struct {
	Token         string `json:"token" validate:"required"`
	Action        string `json:"action" validate:"required"`
	SiteKey       string `json:"site_key,omitempty"`
	UserIPAddress string `json:"user_ip_address,omitempty"`
	UserAgent     string `json:"user_agent,omitempty"`
}

// ========================
// Handlers
// ========================

// Verify handles POST /recaptcha/verify
// This endpoint allows SDKs to verify reCAPTCHA tokens through DataClaus
// keeping Google Cloud credentials server-side
func (h *RecaptchaHandler) Verify(c echo.Context) error {
	var dto VerifyRecaptchaDTO
	if err := validation.ValidateDTO(c, &dto); err != nil {
		return err
	}

	// Use client IP if not provided
	if dto.UserIPAddress == "" {
		dto.UserIPAddress = c.RealIP()
	}

	// Use User-Agent if not provided
	if dto.UserAgent == "" {
		dto.UserAgent = c.Request().UserAgent()
	}

	result, err := h.service.Verify(c.Request().Context(), services.VerifyRequest{
		Token:         dto.Token,
		Action:        dto.Action,
		SiteKey:       dto.SiteKey,
		UserIPAddress: dto.UserIPAddress,
		UserAgent:     dto.UserAgent,
	})

	if err != nil {
		switch err {
		case services.ErrRecaptchaNotConfigured:
			return c.JSON(http.StatusServiceUnavailable, map[string]string{
				"error": "reCAPTCHA service not configured",
			})
		default:
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": err.Error(),
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid":   result.Valid,
		"score":   result.Score,
		"is_bot":  result.IsBot,
		"action":  result.Action,
		"reasons": result.Reasons,
	})
}

// VerifyAndBlock handles POST /recaptcha/verify-block
// Returns an error if bot is detected - useful for protecting form submissions
func (h *RecaptchaHandler) VerifyAndBlock(c echo.Context) error {
	var dto VerifyRecaptchaDTO
	if err := validation.ValidateDTO(c, &dto); err != nil {
		return err
	}

	if dto.UserIPAddress == "" {
		dto.UserIPAddress = c.RealIP()
	}

	if dto.UserAgent == "" {
		dto.UserAgent = c.Request().UserAgent()
	}

	err := h.service.VerifyAndBlock(c.Request().Context(), services.VerifyRequest{
		Token:         dto.Token,
		Action:        dto.Action,
		SiteKey:       dto.SiteKey,
		UserIPAddress: dto.UserIPAddress,
		UserAgent:     dto.UserAgent,
	})

	if err != nil {
		switch err {
		case services.ErrRecaptchaNotConfigured:
			return c.JSON(http.StatusServiceUnavailable, map[string]string{
				"error":   "reCAPTCHA service not configured",
				"allowed": "true", // Fail open
			})
		case services.ErrRecaptchaVerifyFailed:
			return c.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error":   "Token verification failed",
				"allowed": false,
			})
		case services.ErrRecaptchaBotDetected:
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"error":   "Bot activity detected",
				"allowed": false,
			})
		default:
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": err.Error(),
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"allowed": true,
		"message": "Verification passed",
	})
}

// GetConfig handles GET /recaptcha/config
// Returns the site key for client-side integration
func (h *RecaptchaHandler) GetConfig(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"site_key":   h.service.GetSiteKey(),
		"enabled":    h.service.IsConfigured(),
		"threshold":  services.BotScoreThreshold,
	})
}

// RecaptchaMiddleware creates middleware that verifies reCAPTCHA tokens
// Token should be passed in X-Recaptcha-Token header
func (h *RecaptchaHandler) Middleware(action string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			token := c.Request().Header.Get("X-Recaptcha-Token")
			if token == "" {
				// No token provided, skip verification
				// This allows the middleware to be used for optional verification
				return next(c)
			}

			err := h.service.VerifyAndBlock(c.Request().Context(), services.VerifyRequest{
				Token:         token,
				Action:        action,
				UserIPAddress: c.RealIP(),
				UserAgent:     c.Request().UserAgent(),
			})

			if err != nil {
				switch err {
				case services.ErrRecaptchaBotDetected:
					return c.JSON(http.StatusForbidden, map[string]string{
						"error": "Bot activity detected",
					})
				case services.ErrRecaptchaVerifyFailed:
					return c.JSON(http.StatusUnauthorized, map[string]string{
						"error": "reCAPTCHA verification failed",
					})
				case services.ErrRecaptchaNotConfigured:
					// Fail open if not configured
					return next(c)
				default:
					// Fail open on errors
					return next(c)
				}
			}

			return next(c)
		}
	}
}
