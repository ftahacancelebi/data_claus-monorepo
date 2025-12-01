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
		hostVal, hostOk := saveEnv("POSTGRES_HOST")
		portVal, portOk := saveEnv("POSTGRES_PORT")
		userVal, userOk := saveEnv("POSTGRES_USER")
		passVal, passOk := saveEnv("POSTGRES_PASSWORD")
		dbVal, dbOk := saveEnv("POSTGRES_DB")
		sslVal, sslOk := saveEnv("POSTGRES_SSLMODE")
		srvPortVal, srvPortOk := saveEnv("SERVER_PORT")
		envVal, envOk := saveEnv("APP_ENV")

		defer func() {
			restoreEnv("POSTGRES_HOST", hostVal, hostOk)
			restoreEnv("POSTGRES_PORT", portVal, portOk)
			restoreEnv("POSTGRES_USER", userVal, userOk)
			restoreEnv("POSTGRES_PASSWORD", passVal, passOk)
			restoreEnv("POSTGRES_DB", dbVal, dbOk)
			restoreEnv("POSTGRES_SSLMODE", sslVal, sslOk)
			restoreEnv("SERVER_PORT", srvPortVal, srvPortOk)
			restoreEnv("APP_ENV", envVal, envOk)
		}()

		// Set test values
		os.Setenv("POSTGRES_HOST", "testhost")
		os.Setenv("POSTGRES_PORT", "5433")
		os.Setenv("POSTGRES_USER", "testuser")
		os.Setenv("POSTGRES_PASSWORD", "testpass")
		os.Setenv("POSTGRES_DB", "testdb")
		os.Setenv("POSTGRES_SSLMODE", "require")
		os.Setenv("SERVER_PORT", "9090")
		os.Setenv("APP_ENV", "test")

		cfg := LoadConfig()

		assert.Equal(t, "testhost", cfg.DBHost)
		assert.Equal(t, "5433", cfg.DBPort)
		assert.Equal(t, "testuser", cfg.DBUser)
		assert.Equal(t, "testpass", cfg.DBPassword)
		assert.Equal(t, "testdb", cfg.DBName)
		assert.Equal(t, "require", cfg.DBSSLMode)
		assert.Equal(t, "9090", cfg.ServerPort)
		assert.Equal(t, "test", cfg.AppEnv)

		expectedDSN := "host=testhost user=testuser password=testpass dbname=testdb port=5433 sslmode=require"
		assert.Equal(t, expectedDSN, cfg.GetDSN())
	})

	t.Run("LoadConfig with defaults", func(t *testing.T) {
		// Save current state - same as above, could refactor but keeping simple

		// ... (omitting full save/restore for brevity in thought, but will include in code)
		// Actually, I should just unset everything relevant.
		// Ideally I'd use a helper that clears all relevant envs.

		vars := []string{"POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_SSLMODE", "SERVER_PORT", "APP_ENV"}
		saved := make(map[string]string)
		exists := make(map[string]bool)

		for _, v := range vars {
			val, ok := os.LookupEnv(v)
			saved[v] = val
			exists[v] = ok
			os.Unsetenv(v)
		}

		defer func() {
			for _, v := range vars {
				if exists[v] {
					os.Setenv(v, saved[v])
				} else {
					os.Unsetenv(v)
				}
			}
		}()

		cfg := LoadConfig()

		// Check against defaults defined in config.go
		assert.Equal(t, "localhost", cfg.DBHost)
		assert.Equal(t, "5432", cfg.DBPort)
		assert.Equal(t, "postgres", cfg.DBUser)
		assert.Equal(t, "postgres", cfg.DBPassword)
		assert.Equal(t, "dataclaus", cfg.DBName)
		assert.Equal(t, "disable", cfg.DBSSLMode)
		assert.Equal(t, "3000", cfg.ServerPort)
		assert.Equal(t, "development", cfg.AppEnv)

		expectedDefaultDSN := "host=localhost user=postgres password=postgres dbname=dataclaus port=5432 sslmode=disable"
		assert.Equal(t, expectedDefaultDSN, cfg.GetDSN())
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
