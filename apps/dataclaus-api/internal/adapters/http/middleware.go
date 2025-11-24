package http

import (
	"apps/dataclaus-api/internal/adapters/http/validation"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/rs/zerolog/log"
)

func ApplyMiddlewares(e *echo.Echo) {
	// Create a global validator instance
	validator := validation.NewValidator()

	// Request logger middleware
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogURI:     true,
		LogStatus:  true,
		LogMethod:  true,
		LogLatency: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			log.Info().
				Str("URI", v.URI).
				Int("status", v.Status).
				Str("method", v.Method).
				Dur("latency", v.Latency).
				Msg("request")

			return nil
		},
	}))

	// Recovery middleware
	e.Use(middleware.Recover())

	// CORS middleware
	e.Use(middleware.CORS())

	// Inject validator into context
	e.Use(validation.InjectValidator(validator))
}
