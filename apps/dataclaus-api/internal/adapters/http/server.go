package http

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func NewServer(userHandler *UserHandler, ingestHandler *IngestHandler) *echo.Echo {
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	ApplyMiddlewares(e)

	e.GET("health", func(c echo.Context) error {
		return c.JSON(http.StatusOK,
			map[string]interface{}{
				"status":  "ok",
				"version": "1.0.0",
			},
		)
	})

	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "Welcome to DataClaus API")
	})

	// User routes
	e.POST("/users", userHandler.Create)
	e.GET("/users/:id", userHandler.Get)

	// Ingest routes
	e.POST("/v1/ingest", ingestHandler.Ingest)

	return e
}
