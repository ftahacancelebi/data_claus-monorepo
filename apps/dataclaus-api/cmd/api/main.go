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
	repository "apps/dataclaus-api/internal/adapters/repository/postgres"
	"apps/dataclaus-api/internal/config"
	"apps/dataclaus-api/internal/core/services"
	"apps/dataclaus-api/internal/database"
)

// Dependencies that can be mocked for testing
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
	// Configure zerolog
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// Load config
	cfg := config.LoadConfig()

	// Connect to database
	db, err := newDB(cfg.GetDSN())
	if err != nil {
		return err
	}

	// Run database migrations
	if err := database.RunMigrations(db); err != nil {
		return err
	}

	// Initialize User System
	userRepo := repository.NewUserRepository(db)
	userService := services.NewUserService(userRepo)
	userHandler := adapterHttp.NewUserHandler(userService)

	// initializing server
	server := newServer(userHandler)

	// starting server with graceful shutdown
	go func() {
		log.Info().Str("port", cfg.ServerPort).Msg("Server started")
		if err := server.Start(":" + cfg.ServerPort); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	// --- Graceful Shutdown ---
	// handling os signals
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)

	select {
	case <-quit:
		log.Info().Msg("Signal received, shutting down...")
	case <-ctx.Done():
		log.Info().Msg("Context done, shutting down...")
	}

	log.Info().Msg("System shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		return err
	}

	return nil
}
