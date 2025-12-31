package database

import (
	"apps/dataclaus-api/internal/adapters/repository/postgres"
	"apps/dataclaus-api/internal/core/domain"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

func RunMigrations(db *gorm.DB) error {
	log.Info().Msg("Running database migrations...")

	err := db.AutoMigrate(
		// Existing tables
		&postgres.UserGorm{},
		&postgres.WalletGorm{},
		&postgres.CampaignGorm{},
		&postgres.LedgerTransactionGorm{},
		&postgres.DeveloperGorm{},
		&postgres.APIKeyGorm{},
		&postgres.ScoredEventGorm{},
		&postgres.UserSessionGorm{},

		// DataClaus user tables
		&domain.DataClausUser{},
		&domain.DeviceFingerprint{},
		&domain.OTPCode{},
		&domain.DataClausUserSession{},
		&domain.LinkedExternalUser{},

		// Ad revenue tables
		&domain.AdImpression{},
	)

	if err != nil {
		log.Error().Err(err).Msg("Failed to run migrations")
		return err
	}

	log.Info().Msg("Database migrations completed successfully")
	return nil
}



