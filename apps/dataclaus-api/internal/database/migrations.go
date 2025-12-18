package database

import (
	"apps/dataclaus-api/internal/adapters/repository/postgres"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

func RunMigrations(db *gorm.DB) error {
	log.Info().Msg("Running database migrations...")

	err := db.AutoMigrate(
		&postgres.UserGorm{},
		&postgres.WalletGorm{},
		&postgres.CampaignGorm{},
		&postgres.LedgerTransactionGorm{},
		&postgres.DeveloperGorm{},
		&postgres.APIKeyGorm{},
		&postgres.ScoredEventGorm{},
		&postgres.UserSessionGorm{},
	)

	if err != nil {
		log.Error().Err(err).Msg("Failed to run migrations")
		return err
	}

	log.Info().Msg("Database migrations completed successfully")
	return nil
}
