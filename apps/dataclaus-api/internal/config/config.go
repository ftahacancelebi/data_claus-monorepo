package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost       string
	DBPort       string
	DBUser       string
	DBPassword   string
	DBName       string
	DBSSLMode    string
	ServerPort   string
	AppEnv       string
	KafkaBrokers []string
	HMACSecret   string
}

func LoadConfig() *Config {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../../.env")

	kafkaBrokersStr := getEnv("KAFKA_BROKERS", "localhost:9092")
	kafkaBrokers := strings.Split(kafkaBrokersStr, ",")

	return &Config{
		DBHost:       getEnv("POSTGRES_HOST", "localhost"),
		DBPort:       getEnv("POSTGRES_PORT", "5432"),
		DBUser:       getEnv("POSTGRES_USER", "postgres"),
		DBPassword:   getEnv("POSTGRES_PASSWORD", "postgres"),
		DBName:       getEnv("POSTGRES_DB", "dataclaus"),
		DBSSLMode:    getEnv("POSTGRES_SSLMODE", "disable"),
		ServerPort:   getEnv("SERVER_PORT", "3000"),
		AppEnv:       getEnv("APP_ENV", "development"),
		KafkaBrokers: kafkaBrokers,
		HMACSecret:   getEnv("HMAC_SECRET", "default-secret-change-in-production"),
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
