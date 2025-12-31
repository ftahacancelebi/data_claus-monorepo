package http

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type Handlers struct {
	User          *UserHandler
	Auth          *AuthHandler
	DataClausUser *DataClausUserHandler // End-user authentication
	Ads           *AdsHandler           // Ad revenue tracking
	Recaptcha     *RecaptchaHandler     // Bot protection
	Ingest        *IngestHandler
	Developer     *DeveloperHandler
	Application   *ApplicationHandler
	Wallet        *WalletHandler
	Campaign      *CampaignHandler
	Ledger        *LedgerHandler
	Analytics     *AnalyticsHandler
	HMAC          *HMACMiddleware
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

	// ========================
	// Internal User Routes (for platform admin)
	// ========================
	e.POST("/users", h.User.Create)
	e.GET("/users/:id", h.User.Get)

	// ========================
	// Developer/Admin Authentication
	// ========================
	e.POST("/auth/login", h.Auth.Login)

	// ========================
	// DataClaus User Authentication (End Users)
	// ========================
	if h.DataClausUser != nil {
		userAuth := e.Group("/auth/user")
		userAuth.POST("/request-otp", h.DataClausUser.RequestOTP)
		userAuth.POST("/verify-otp", h.DataClausUser.VerifyOTP)
		userAuth.POST("/verify", h.DataClausUser.Verify) // For SDK token verification
		userAuth.POST("/refresh", h.DataClausUser.RefreshToken)
		userAuth.POST("/logout", h.DataClausUser.Logout)

		// Protected user routes (require auth)
		userAuthProtected := e.Group("/auth/user")
		userAuthProtected.Use(h.DataClausUser.UserAuthMiddleware())
		userAuthProtected.GET("/me", h.DataClausUser.GetMe)
		userAuthProtected.PUT("/profile", h.DataClausUser.UpdateProfile)

		// User earnings
		e.GET("/users/:userId/earnings", h.DataClausUser.GetEarnings)
	}

	// ========================
	// Ad Revenue Routes
	// ========================
	if h.Ads != nil {
		// Public endpoint for ad rates
		e.GET("/ads/rates", h.Ads.GetAdRates)

		// Application ad routes (HMAC protected in production)
		e.POST("/applications/:appId/ads/impression", h.Ads.RecordImpression)
		e.GET("/applications/:appId/ads/config", h.Ads.GetAdConfig)
		e.GET("/applications/:appId/ads/summary", h.Ads.GetApplicationRevenueSummary)

		// User ad summary
		e.GET("/users/:userId/ads/summary", h.Ads.GetUserRevenueSummary)

		// Developer ad summary
		e.GET("/developers/:developerId/ads/summary", h.Ads.GetDeveloperRevenueSummary)
	}

	// ========================
	// reCAPTCHA Enterprise Routes
	// ========================
	if h.Recaptcha != nil {
		e.POST("/recaptcha/verify", h.Recaptcha.Verify)
		e.POST("/recaptcha/verify-block", h.Recaptcha.VerifyAndBlock)
		e.GET("/recaptcha/config", h.Recaptcha.GetConfig)
	}

	// ========================
	// Developer Routes
	// ========================
	e.POST("/developers", h.Developer.Register)
	e.GET("/developers/:id", h.Developer.Get)
	e.PUT("/developers/:id/user-share", h.Developer.UpdateUserShare)
	e.POST("/developers/:id/api-keys", h.Developer.GenerateAPIKey)
	e.GET("/developers/:id/api-keys", h.Developer.ListAPIKeys)
	e.DELETE("/developers/:id/api-keys/:keyId", h.Developer.RevokeAPIKey)

	// ========================
	// Application Routes
	// ========================
	if h.Application != nil {
		e.POST("/developers/:developerId/applications", h.Application.Create)
		e.GET("/developers/:developerId/applications", h.Application.GetByDeveloper)
		e.GET("/applications/:id", h.Application.Get)
		e.GET("/applications/:id/stats", h.Application.GetStats)
		e.PUT("/applications/:id", h.Application.Update)
		e.PATCH("/applications/:id/status", h.Application.ToggleStatus)
		e.DELETE("/applications/:id", h.Application.Delete)
	}

	// ========================
	// Wallet Routes
	// ========================
	e.POST("/wallets", h.Wallet.Create)
	e.GET("/wallets/:id", h.Wallet.Get)
	e.GET("/wallets/owner/:ownerId", h.Wallet.GetByOwner)
	e.POST("/wallets/:id/credit", h.Wallet.Credit)
	e.POST("/wallets/:id/debit", h.Wallet.Debit)
	e.POST("/wallets/:id/release-pending", h.Wallet.ReleasePending)
	e.GET("/config/revenue-shares", h.Wallet.GetRevenueShares)

	// ========================
	// Campaign Routes
	// ========================
	e.POST("/campaigns", h.Campaign.Create)
	e.GET("/campaigns", h.Campaign.GetActive)
	e.GET("/campaigns/:id", h.Campaign.Get)
	e.GET("/campaigns/buyer/:buyerId", h.Campaign.GetByBuyer)
	e.PATCH("/campaigns/:id/status", h.Campaign.UpdateStatus)

	// ========================
	// Transaction/Ledger Routes
	// ========================
	e.GET("/transactions", h.Ledger.GetAll)
	e.GET("/transactions/:id", h.Ledger.Get)
	e.GET("/wallets/:walletId/transactions", h.Ledger.GetByWallet)

	// ========================
	// Analytics Routes
	// ========================
	e.GET("/analytics/events", h.Analytics.GetEvents)
	e.GET("/analytics/quality-score/:userId", h.Analytics.GetUserQualityScore)
	e.GET("/analytics/dashboard", h.Analytics.GetDashboard)

	// ========================
	// Data Ingestion (HMAC Protected)
	// ========================
	ingest := e.Group("/v1")
	ingest.Use(h.HMAC.Validate())
	ingest.POST("/ingest", h.Ingest.Ingest)
	ingest.POST("/ingest/batch", h.Ingest.IngestBatch)

	return e
}
