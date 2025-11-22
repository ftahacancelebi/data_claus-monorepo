package http

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func NewServer() *echo.Echo {
	e := echo.New()

	ApplyMiddlewares(e)
	
	e.GET("health", func(c echo.Context) error {
		return c.String(http.StatusOK, "OK")
	})	
	return e
}