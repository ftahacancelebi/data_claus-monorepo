package http

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/rs/zerolog/log"
)

func ApplyMiddlewares(e *echo.Echo) {
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
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())
}
