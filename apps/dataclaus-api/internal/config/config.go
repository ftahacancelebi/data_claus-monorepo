package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	// Database
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// Server
	ServerPort string
	AppEnv     string

	// Kafka
	KafkaBrokers []string

	// Security
	HMACSecret string
	JWTSecret  string

	// reCAPTCHA Enterprise
	RecaptchaEnabled   bool
	RecaptchaProjectID string
	RecaptchaSiteKey   string
	RecaptchaAPIKey    string
}

func LoadConfig() *Config {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../../.env")

	kafkaBrokersStr := getEnv("KAFKA_BROKERS", "localhost:9094")
	kafkaBrokers := strings.Split(kafkaBrokersStr, ",")

	return &Config{
		// Database
		DBHost:     getEnv("POSTGRES_HOST", "localhost"),
		DBPort:     getEnv("POSTGRES_PORT", "5432"),
		DBUser:     getEnv("POSTGRES_USER", "postgres"),
		DBPassword: getEnv("POSTGRES_PASSWORD", "postgres"),
		DBName:     getEnv("POSTGRES_DB", "dataclaus"),
		DBSSLMode:  getEnv("POSTGRES_SSLMODE", "disable"),

		// Server
		ServerPort: getEnv("SERVER_PORT", "3000"),
		AppEnv:     getEnv("APP_ENV", "development"),

		// Kafka
		KafkaBrokers: kafkaBrokers,

		// Security
		HMACSecret: getEnv("HMAC_SECRET", "default-secret-change-in-production"),
		JWTSecret:  getEnv("JWT_SECRET", "jwt-secret-change-in-production-please"),

		// reCAPTCHA Enterprise
		RecaptchaEnabled:   getEnvBool("RECAPTCHA_ENABLED", false),
		RecaptchaProjectID: getEnv("RECAPTCHA_PROJECT_ID", ""),
		RecaptchaSiteKey:   getEnv("RECAPTCHA_SITE_KEY", ""),
		RecaptchaAPIKey:    getEnv("RECAPTCHA_API_KEY", ""),
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

func getEnvBool(key string, fallback bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		return strings.ToLower(value) == "true" || value == "1"
	}
	return fallback
}
