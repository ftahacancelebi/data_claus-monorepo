package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseDSN string
	ServerPort  string
	AppEnv      string
}

func LoadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("Could not load .env file")
	}

	return &Config{
		DatabaseDSN: getEnv("DATABASE_DSN", "host=localhost user=postgres password=postgres dbname=dataclaus port=5432 sslmode=disable"),
		ServerPort:  getEnv("SERVER_PORT", "8080"),
		AppEnv:      getEnv("APP_ENV", "development"),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}