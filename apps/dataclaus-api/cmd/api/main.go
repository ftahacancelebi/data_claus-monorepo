package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	adapterHttp "apps/dataclaus-api/internal/adapters/http"
	"apps/dataclaus-api/internal/config"
	"apps/dataclaus-api/pkg/database"
)

func main() {
	// Load config
	cfg := config.LoadConfig()

	// Connect to database
	// we will implement in repository layer
	db, err := database.NewPostgresDB(cfg.DatabaseDSN)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	// escaping from go compiler
	_ = db 

	// initializing server
	server := adapterHttp.NewServer()

	// starting server with graceful shutdown
	go func() {
		log.Printf("Server started on port %s", cfg.ServerPort)
		if err := server.Start(":" + cfg.ServerPort); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// --- Graceful Shutdown ---
	// handling os signals
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit // wait for signal

	log.Println("System shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		server.Logger.Fatal(err)
	}
}