package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func createTestHandlers() *Handlers {
	return &Handlers{
		User:      NewUserHandler(nil),
		Ingest:    NewIngestHandler(nil),
		Developer: NewDeveloperHandler(nil, nil),
		Wallet:    NewWalletHandler(nil),
		Campaign:  NewCampaignHandler(nil),
		Ledger:    NewLedgerHandler(nil),
		Analytics: NewAnalyticsHandler(nil),
		HMAC:      NewHMACMiddleware(nil),
	}
}

func TestNewServer(t *testing.T) {
	e := NewServer(createTestHandlers())
	assert.NotNil(t, e)
}

func TestHealthCheck(t *testing.T) {
	e := NewServer(createTestHandlers())
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	expectedBody := `{"status":"ok","version":"1.0.0"}` + "\n"
	assert.Equal(t, expectedBody, rec.Body.String())
}
