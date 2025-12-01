package http

import (
	"net/http"

	"apps/dataclaus-api/internal/adapters/http/validation"

	"github.com/labstack/echo/v4"
)

// CustomHTTPErrorHandler handles errors and formats them as JSON.
func CustomHTTPErrorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}

	code := http.StatusInternalServerError
	var message interface{} = "Internal Server Error"

	// Check if it's a Validation Error
	if ve, ok := validation.IsValidationError(err); ok {
		code = http.StatusUnprocessableEntity
		message = map[string]interface{}{
			"error":   "validation_failed",
			"message": "Request validation failed",
			"errors":  ve.Errors,
		}
	} else if he, ok := err.(*echo.HTTPError); ok {
		// Echo HTTP Error
		code = he.Code
		message = he.Message
	} else {
		// Default error
		message = map[string]string{"error": err.Error()}
	}

	// Send response
	if err := c.JSON(code, message); err != nil {
		c.Logger().Error(err)
	}
}
