package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	ServerPort string
	AppEnv     string
}

func LoadConfig() *Config {
	// Load .env files. Local .env takes precedence over root .env.
	// We ignore errors because it's fine if one or both are missing (e.g. in prod).
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../../.env")

	return &Config{
		DBHost:     getEnv("POSTGRES_HOST", "localhost"),
		DBPort:     getEnv("POSTGRES_PORT", "5432"),
		DBUser:     getEnv("POSTGRES_USER", "postgres"),
		DBPassword: getEnv("POSTGRES_PASSWORD", "postgres"),
		DBName:     getEnv("POSTGRES_DB", "dataclaus"),
		DBSSLMode:  getEnv("POSTGRES_SSLMODE", "disable"),
		ServerPort: getEnv("SERVER_PORT", "3000"),
		AppEnv:     getEnv("APP_ENV", "development"),
	}
}

func (c *Config) GetDSN() string {
	return "host=" + c.DBHost +
		" user=" + c.DBUser +
		" password=" + c.DBPassword +
		" dbname=" + c.DBName +
		" port=" + c.DBPort +
		" sslmode=" + c.DBSSLMode
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}