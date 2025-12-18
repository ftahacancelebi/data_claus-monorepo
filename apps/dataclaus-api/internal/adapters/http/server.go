package http

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type Handlers struct {
	User      *UserHandler
	Ingest    *IngestHandler
	Developer *DeveloperHandler
	Wallet    *WalletHandler
	Campaign  *CampaignHandler
	Ledger    *LedgerHandler
	Analytics *AnalyticsHandler
	HMAC      *HMACMiddleware
}

func NewServer(h *Handlers) *echo.Echo {
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	ApplyMiddlewares(e)

	e.GET("health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status":  "ok",
			"version": "1.0.0",
		})
	})

	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "Welcome to DataClaus API")
	})

	e.POST("/users", h.User.Create)
	e.GET("/users/:id", h.User.Get)

	e.POST("/developers", h.Developer.Register)
	e.GET("/developers/:id", h.Developer.Get)
	e.PUT("/developers/:id/user-share", h.Developer.UpdateUserShare)
	e.POST("/developers/:id/api-keys", h.Developer.GenerateAPIKey)
	e.GET("/developers/:id/api-keys", h.Developer.ListAPIKeys)
	e.DELETE("/developers/:id/api-keys/:keyId", h.Developer.RevokeAPIKey)

	e.POST("/wallets", h.Wallet.Create)
	e.GET("/wallets/:id", h.Wallet.Get)
	e.GET("/wallets/owner/:ownerId", h.Wallet.GetByOwner)
	e.POST("/wallets/:id/credit", h.Wallet.Credit)
	e.POST("/wallets/:id/debit", h.Wallet.Debit)
	e.POST("/wallets/:id/release-pending", h.Wallet.ReleasePending)
	e.GET("/config/revenue-shares", h.Wallet.GetRevenueShares)

	e.POST("/campaigns", h.Campaign.Create)
	e.GET("/campaigns", h.Campaign.GetActive)
	e.GET("/campaigns/:id", h.Campaign.Get)
	e.GET("/campaigns/buyer/:buyerId", h.Campaign.GetByBuyer)
	e.PATCH("/campaigns/:id/status", h.Campaign.UpdateStatus)

	e.GET("/transactions", h.Ledger.GetAll)
	e.GET("/transactions/:id", h.Ledger.Get)
	e.GET("/wallets/:walletId/transactions", h.Ledger.GetByWallet)

	e.GET("/analytics/events", h.Analytics.GetEvents)
	e.GET("/analytics/quality-score/:userId", h.Analytics.GetUserQualityScore)
	e.GET("/analytics/dashboard", h.Analytics.GetDashboard)

	ingest := e.Group("/v1")
	ingest.Use(h.HMAC.Validate())
	ingest.POST("/ingest", h.Ingest.Ingest)

	return e
}
