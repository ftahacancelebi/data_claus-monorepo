package http

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func NewServer() *echo.Echo {
	e := echo.New()

	ApplyMiddlewares(e)
	
	e.GET("health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, 
			map[string]interface{}{
				"status": "ok",
				"version": "1.0.0",
			},
		)
	})

	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "Welcome to DataClaus API")
	})
	return e
}