package database

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewPostgresDB(t *testing.T) {
	t.Run("returns error with invalid dsn", func(t *testing.T) {

		db, err := NewPostgresDB("host=invalid user=invalid password=invalid dbname=invalid port=5432 sslmode=disable")
		if err != nil {
			assert.Nil(t, db)
			assert.Error(t, err)
		} else {
			assert.NotNil(t, db)
		}
	})
}
