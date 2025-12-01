package database

import (
	"apps/dataclaus-api/internal/adapters/repository/postgres"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// RunMigrations executes all database migrations.
// This uses GORM's AutoMigrate feature to create/update tables based on the models.
func RunMigrations(db *gorm.DB) error {
	log.Info().Msg("Running database migrations...")

	// Drop existing users table if it exists to fix type mismatches (dev only)
	if db.Migrator().HasTable(&postgres.UserGorm{}) {
		if err := db.Migrator().DropTable(&postgres.UserGorm{}); err != nil {
			log.Error().Err(err).Msg("Failed to drop existing users table")
			return err
		}
		log.Info().Msg("Dropped existing users table for fresh migration")
	}

	// AutoMigrate will create tables, missing columns and missing indexes
	// It will NOT delete unused columns or change existing column types
	err := db.AutoMigrate(
		&postgres.UserGorm{},
		&postgres.WalletGorm{},
		&postgres.CampaignGorm{},
		&postgres.LedgerTransactionGorm{},
	)

	if err != nil {
		log.Error().Err(err).Msg("Failed to run migrations")
		return err
	}

	log.Info().Msg("Database migrations completed successfully")
	return nil
}

