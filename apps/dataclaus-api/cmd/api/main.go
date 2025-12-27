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

	userRepo := repository.NewUserRepository(db)
	userService := services.NewUserService(userRepo)
	userHandler := adapterHttp.NewUserHandler(userService)

	devRepo := repository.NewDeveloperRepository(db)
	apiKeyRepo := repository.NewAPIKeyRepository(db)
	devService := services.NewDeveloperService(devRepo)
	apiKeyService := services.NewAPIKeyService(apiKeyRepo, devRepo)
	devHandler := adapterHttp.NewDeveloperHandler(devService, apiKeyService)

	authHandler := adapterHttp.NewAuthHandler(userService, devService, cfg.JWTSecret)


	walletRepo := repository.NewWalletRepository(db)
	walletService := services.NewWalletService(walletRepo)
	walletHandler := adapterHttp.NewWalletHandler(walletService)

	campaignRepo := repository.NewCampaignRepository(db)
	campaignService := services.NewCampaignService(campaignRepo)
	campaignHandler := adapterHttp.NewCampaignHandler(campaignService)

	ledgerRepo := repository.NewLedgerRepository(db)
	ledgerService := services.NewLedgerService(ledgerRepo)
	ledgerHandler := adapterHttp.NewLedgerHandler(ledgerService)

	eventRepo := repository.NewScoredEventRepository(db)
	analyticsService := services.NewAnalyticsService(eventRepo, userRepo, devRepo, campaignRepo, ledgerRepo)
	analyticsHandler := adapterHttp.NewAnalyticsHandler(analyticsService)

	kafkaProducer := kafka.NewProducer(cfg.KafkaBrokers)
	ingestHandler := adapterHttp.NewIngestHandler(kafkaProducer)

	hmacMiddleware := adapterHttp.NewHMACMiddleware(apiKeyService)

	handlers := &adapterHttp.Handlers{
		User:      userHandler,
		Auth:      authHandler,
		Ingest:    ingestHandler,
		Developer: devHandler,
		Wallet:    walletHandler,
		Campaign:  campaignHandler,
		Ledger:    ledgerHandler,
		Analytics: analyticsHandler,
		HMAC:      hmacMiddleware,
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
