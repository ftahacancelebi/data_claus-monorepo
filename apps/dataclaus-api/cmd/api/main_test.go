package main

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

func TestRun(t *testing.T) {
	// Save original functions and restore them after test
	origNewDB := newDB
	defer func() { newDB = origNewDB }()

	// Mock DB connection
	newDB = func(dsn string) (*gorm.DB, error) {
		return &gorm.DB{}, nil
	}

	// Set random port to avoid conflicts
	os.Setenv("SERVER_PORT", "0")
	defer os.Unsetenv("SERVER_PORT")

	t.Run("Successful startup and shutdown", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		
		// Cancel context after a short delay to simulate shutdown
		go func() {
			time.Sleep(100 * time.Millisecond)
			cancel()
		}()

		err := run(ctx)
		assert.NoError(t, err)
	})

	t.Run("Database connection failure", func(t *testing.T) {
		// Mock DB failure
		newDB = func(dsn string) (*gorm.DB, error) {
			return nil, errors.New("db connection failed")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		err := run(ctx)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "db connection failed")
	})
}