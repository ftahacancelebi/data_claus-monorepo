package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	adapterHttp "apps/dataclaus-api/internal/adapters/http"
	"apps/dataclaus-api/internal/adapters/messaging/kafka"
	repository "apps/dataclaus-api/internal/adapters/repository/postgres"
	"apps/dataclaus-api/internal/config"
	"apps/dataclaus-api/internal/core/services"
	"apps/dataclaus-api/internal/database"
)

var (
	newDB     func(dsn string) (*gorm.DB, error) = database.NewPostgresDB
	newServer                                    = adapterHttp.NewServer
)

func main() {
	if err := run(context.Background()); err != nil {
		log.Fatal().Err(err).Msg("Application failed")
	}
}

func run(ctx context.Context) error {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	cfg := config.LoadConfig()

	db, err := newDB(cfg.GetDSN())
	if err != nil {
		return err
	}

	if err := database.RunMigrations(db); err != nil {
		return err
	}

	// ========================
	// Internal User (Admin)
	// ========================
	userRepo := repository.NewUserRepository(db)
	userService := services.NewUserService(userRepo)
	userHandler := adapterHttp.NewUserHandler(userService)

	// ========================
	// Developer
	// ========================
	devRepo := repository.NewDeveloperRepository(db)
	apiKeyRepo := repository.NewAPIKeyRepository(db)
	devService := services.NewDeveloperService(devRepo)
	apiKeyService := services.NewAPIKeyService(apiKeyRepo, devRepo)
	devHandler := adapterHttp.NewDeveloperHandler(devService, apiKeyService)

	// ========================
	// Developer/Admin Authentication
	// ========================
	authHandler := adapterHttp.NewAuthHandler(userService, devService, cfg.JWTSecret)

	// ========================
	// Wallet & Financial
	// ========================
	walletRepo := repository.NewWalletRepository(db)
	walletService := services.NewWalletService(walletRepo)
	walletHandler := adapterHttp.NewWalletHandler(walletService)

	// ========================
	// DataClaus User (End Users)
	// ========================
	dataclausUserRepo := repository.NewDataClausUserRepository(db)
	dataclausUserService := services.NewDataClausUserService(dataclausUserRepo, walletService)
	dataclausUserHandler := adapterHttp.NewDataClausUserHandler(dataclausUserService)

	// ========================
	// Campaigns
	// ========================
	campaignRepo := repository.NewCampaignRepository(db)
	campaignService := services.NewCampaignService(campaignRepo)
	campaignHandler := adapterHttp.NewCampaignHandler(campaignService)

	// ========================
	// Ledger
	// ========================
	ledgerRepo := repository.NewLedgerRepository(db)
	ledgerService := services.NewLedgerService(ledgerRepo)
	ledgerHandler := adapterHttp.NewLedgerHandler(ledgerService)

	// ========================
	// Analytics
	// ========================
	eventRepo := repository.NewScoredEventRepository(db)
	analyticsService := services.NewAnalyticsService(eventRepo, userRepo, devRepo, campaignRepo, ledgerRepo)
	analyticsHandler := adapterHttp.NewAnalyticsHandler(analyticsService)

	// ========================
	// Applications
	// ========================
	appRepo := repository.NewApplicationRepository(db)
	appService := services.NewApplicationService(appRepo)
	appHandler := adapterHttp.NewApplicationHandler(appService, apiKeyService)

	// ========================
	// Ads & Revenue
	// ========================
	adImpressionRepo := repository.NewAdImpressionRepository(db)
	adsService := services.NewAdsService(adImpressionRepo, appRepo, walletService, dataclausUserRepo)
	adsHandler := adapterHttp.NewAdsHandler(adsService)

	// ========================
	// reCAPTCHA Enterprise
	// ========================
	recaptchaService := services.NewRecaptchaService(services.RecaptchaConfig{
		Enabled:    cfg.RecaptchaEnabled,
		ProjectID:  cfg.RecaptchaProjectID,
		SiteKey:    cfg.RecaptchaSiteKey,
		APIKey:     cfg.RecaptchaAPIKey,
	})
	recaptchaHandler := adapterHttp.NewRecaptchaHandler(recaptchaService)

	// ========================
	// Kafka & Ingestion
	// ========================
	kafkaProducer := kafka.NewProducer(cfg.KafkaBrokers)
	ingestHandler := adapterHttp.NewIngestHandler(kafkaProducer)

	// ========================
	// HMAC Middleware
	// ========================
	hmacMiddleware := adapterHttp.NewHMACMiddleware(apiKeyService)

	// ========================
	// Assemble Handlers
	// ========================
	handlers := &adapterHttp.Handlers{
		User:          userHandler,
		Auth:          authHandler,
		DataClausUser: dataclausUserHandler,
		Ads:           adsHandler,
		Recaptcha:     recaptchaHandler, // NEW: reCAPTCHA
		Ingest:        ingestHandler,
		Developer:     devHandler,
		Application:   appHandler,
		Wallet:        walletHandler,
		Campaign:      campaignHandler,
		Ledger:        ledgerHandler,
		Analytics:     analyticsHandler,
		HMAC:          hmacMiddleware,
	}

	server := newServer(handlers)

	go func() {
		log.Info().Str("port", cfg.ServerPort).Msg("Server started")
		if err := server.Start(":" + cfg.ServerPort); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)

	select {
	case <-quit:
		log.Info().Msg("Signal received, shutting down...")
	case <-ctx.Done():
		log.Info().Msg("Context done, shutting down...")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return server.Shutdown(shutdownCtx)
}
