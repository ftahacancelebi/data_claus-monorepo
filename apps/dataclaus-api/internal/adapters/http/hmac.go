package http

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"

	"apps/dataclaus-api/internal/core/ports"

	"github.com/labstack/echo/v4"
)

type HMACMiddleware struct {
	apiKeyService ports.APIKeyService
}

func NewHMACMiddleware(apiKeyService ports.APIKeyService) *HMACMiddleware {
	return &HMACMiddleware{apiKeyService: apiKeyService}
}

func (m *HMACMiddleware) Validate() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			apiKey := c.Request().Header.Get("X-API-Key")
			signature := c.Request().Header.Get("X-Signature")

			if apiKey == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "missing X-API-Key header",
				})
			}

			if signature == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "missing X-Signature header",
				})
			}

			key, err := m.apiKeyService.ValidateKey(c.Request().Context(), apiKey)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "invalid API key",
				})
			}

			body, err := io.ReadAll(c.Request().Body)
			if err != nil {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "failed to read request body",
				})
			}
			c.Request().Body = io.NopCloser(bytes.NewBuffer(body))

			expectedSig := computeHMAC(body, apiKey)
			if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "invalid signature",
				})
			}

			c.Set("developer_id", key.DeveloperID)
			c.Set("api_key_id", key.ID)

			return next(c)
		}
	}
}

func computeHMAC(data []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}

func ComputeHMAC(data []byte, secret string) string {
	return computeHMAC(data, secret)
}
