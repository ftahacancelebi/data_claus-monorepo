package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	adapterHttp "apps/dataclaus-api/internal/adapters/http"
	"apps/dataclaus-api/internal/config"
	"apps/dataclaus-api/pkg/database"
)

func main() {
	// Configure zerolog
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// Load config
	cfg := config.LoadConfig()

	// Connect to database
	// we will implement in repository layer
	db, err := database.NewPostgresDB(cfg.GetDSN())
	if err != nil {
		log.Fatal().Err(err).Msg("Database connection failed")
	}
	// escaping from go compiler
	_ = db 

	// initializing server
	server := adapterHttp.NewServer()

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
	<-quit // wait for signal

	log.Info().Msg("System shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}
}