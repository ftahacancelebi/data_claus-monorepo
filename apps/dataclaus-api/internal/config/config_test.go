package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoadConfig(t *testing.T) {
	// Helper to save and restore env vars
	saveEnv := func(key string) (string, bool) {
		val, ok := os.LookupEnv(key)
		return val, ok
	}
	restoreEnv := func(key string, val string, ok bool) {
		if ok {
			os.Setenv(key, val)
		} else {
			os.Unsetenv(key)
		}
	}

	t.Run("LoadConfig with environment variables", func(t *testing.T) {
		// Save current state
		dsnVal, dsnOk := saveEnv("DATABASE_DSN")
		portVal, portOk := saveEnv("SERVER_PORT")
		envVal, envOk := saveEnv("APP_ENV")
		defer func() {
			restoreEnv("DATABASE_DSN", dsnVal, dsnOk)
			restoreEnv("SERVER_PORT", portVal, portOk)
			restoreEnv("APP_ENV", envVal, envOk)
		}()

		// Set test values
		expectedDSN := "host=testdb user=test pass=test dbname=testdb port=5432 sslmode=disable"
		expectedPort := "9090"
		expectedEnv := "test"

		os.Setenv("DATABASE_DSN", expectedDSN)
		os.Setenv("SERVER_PORT", expectedPort)
		os.Setenv("APP_ENV", expectedEnv)

		cfg := LoadConfig()

		assert.Equal(t, expectedDSN, cfg.DatabaseDSN)
		assert.Equal(t, expectedPort, cfg.ServerPort)
		assert.Equal(t, expectedEnv, cfg.AppEnv)
	})

	t.Run("LoadConfig with defaults", func(t *testing.T) {
		// Save current state
		dsnVal, dsnOk := saveEnv("DATABASE_DSN")
		portVal, portOk := saveEnv("SERVER_PORT")
		envVal, envOk := saveEnv("APP_ENV")
		defer func() {
			restoreEnv("DATABASE_DSN", dsnVal, dsnOk)
			restoreEnv("SERVER_PORT", portVal, portOk)
			restoreEnv("APP_ENV", envVal, envOk)
		}()

		// Unset to force defaults
		os.Unsetenv("DATABASE_DSN")
		os.Unsetenv("SERVER_PORT")
		os.Unsetenv("APP_ENV")

		cfg := LoadConfig()

		// Check against defaults defined in config.go
		assert.Equal(t, "host=localhost user=postgres password=postgres dbname=dataclaus port=5432 sslmode=disable", cfg.DatabaseDSN)
		assert.Equal(t, "8080", cfg.ServerPort)
		assert.Equal(t, "development", cfg.AppEnv)
	})
}

func TestGetEnv(t *testing.T) {
	key := "TEST_GET_ENV_KEY"
	val := "some_value"
	fallback := "fallback_value"

	t.Run("returns existing env value", func(t *testing.T) {
		os.Setenv(key, val)
		defer os.Unsetenv(key)

		res := getEnv(key, fallback)
		assert.Equal(t, val, res)
	})

	t.Run("returns fallback when env not set", func(t *testing.T) {
		os.Unsetenv(key)
		res := getEnv(key, fallback)
		assert.Equal(t, fallback, res)
	})
}
