package validation

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// ValidatorMiddleware is a middleware that validates request bodies.
// It should be used with Echo's context binding.
type ValidatorMiddleware struct {
	validator *Validator
}

// NewValidatorMiddleware creates a new validator middleware.
func NewValidatorMiddleware(validator *Validator) *ValidatorMiddleware {
	return &ValidatorMiddleware{
		validator: validator,
	}
}

// ValidateDTO is a helper function that binds and validates a DTO in one step.
// Usage:
//
//	var req CreateUserRequest
//	if err := validation.ValidateDTO(c, &req); err != nil {
//	    return err
//	}
func ValidateDTO(c echo.Context, dto interface{}) error {
	// Bind the request body to the DTO
	if err := c.Bind(dto); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body").SetInternal(err)
	}

	// Get the validator from context or create a new one
	validator, ok := c.Get("validator").(*Validator)
	if !ok {
		validator = NewValidator()
	}

	// Validate the DTO
	if err := validator.Validate(dto); err != nil {
		return err
	}

	return nil
}

// InjectValidator is a middleware that injects the validator into the Echo context.
// This allows handlers to access the validator without creating a new instance.
func InjectValidator(validator *Validator) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("validator", validator)
			return next(c)
		}
	}
}

// GetValidator retrieves the validator from the Echo context.
// If no validator is found, it creates a new one.
func GetValidator(c echo.Context) *Validator {
	if validator, ok := c.Get("validator").(*Validator); ok {
		return validator
	}
	return NewValidator()
}
