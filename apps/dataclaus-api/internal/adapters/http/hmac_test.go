package http

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockAPIKeyService struct {
	mock.Mock
}

func (m *MockAPIKeyService) Generate(ctx context.Context, developerID uuid.UUID, name string) (*domain.APIKey, string, error) {
	args := m.Called(ctx, developerID, name)
	return args.Get(0).(*domain.APIKey), args.String(1), args.Error(2)
}

func (m *MockAPIKeyService) GetByDeveloper(ctx context.Context, developerID uuid.UUID) ([]*domain.APIKey, error) {
	args := m.Called(ctx, developerID)
	return args.Get(0).([]*domain.APIKey), args.Error(1)
}

func (m *MockAPIKeyService) ValidateKey(ctx context.Context, rawKey string) (*domain.APIKey, error) {
	args := m.Called(ctx, rawKey)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.APIKey), args.Error(1)
}

func (m *MockAPIKeyService) Revoke(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func TestHMACMiddleware_MissingAPIKey(t *testing.T) {
	mockService := new(MockAPIKeyService)
	middleware := NewHMACMiddleware(mockService)

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/v1/ingest", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler := middleware.Validate()(func(c echo.Context) error {
		return c.String(http.StatusOK, "success")
	})

	err := handler(c)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "missing X-API-Key header")
}

func TestHMACMiddleware_MissingSignature(t *testing.T) {
	mockService := new(MockAPIKeyService)
	middleware := NewHMACMiddleware(mockService)

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/v1/ingest", nil)
	req.Header.Set("X-API-Key", "test-key")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler := middleware.Validate()(func(c echo.Context) error {
		return c.String(http.StatusOK, "success")
	})

	err := handler(c)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "missing X-Signature header")
}

func TestHMACMiddleware_InvalidAPIKey(t *testing.T) {
	mockService := new(MockAPIKeyService)
	middleware := NewHMACMiddleware(mockService)

	e := echo.New()
	body := []byte(`{"test": "data"}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/ingest", bytes.NewReader(body))
	req.Header.Set("X-API-Key", "invalid-key")
	req.Header.Set("X-Signature", "some-signature")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	mockService.On("ValidateKey", mock.Anything, "invalid-key").Return(nil, assert.AnError)

	handler := middleware.Validate()(func(c echo.Context) error {
		return c.String(http.StatusOK, "success")
	})

	err := handler(c)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "invalid API key")
}

func TestHMACMiddleware_ValidRequest(t *testing.T) {
	mockService := new(MockAPIKeyService)
	middleware := NewHMACMiddleware(mockService)

	e := echo.New()
	body := []byte(`{"test": "data"}`)
	apiKey := "test-api-key"
	signature := ComputeHMAC(body, apiKey)

	req := httptest.NewRequest(http.MethodPost, "/v1/ingest", bytes.NewReader(body))
	req.Header.Set("X-API-Key", apiKey)
	req.Header.Set("X-Signature", signature)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	devID := uuid.New()
	keyID := uuid.New()
	mockService.On("ValidateKey", mock.Anything, apiKey).Return(&domain.APIKey{
		ID:          keyID,
		DeveloperID: devID,
		IsActive:    true,
	}, nil)

	handler := middleware.Validate()(func(c echo.Context) error {
		assert.Equal(t, devID, c.Get("developer_id"))
		assert.Equal(t, keyID, c.Get("api_key_id"))
		return c.String(http.StatusOK, "success")
	})

	err := handler(c)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	mockService.AssertExpectations(t)
}

func TestComputeHMAC(t *testing.T) {
	data := []byte("test data")
	secret := "secret-key"

	sig1 := ComputeHMAC(data, secret)
	sig2 := ComputeHMAC(data, secret)

	assert.Equal(t, sig1, sig2)
	assert.NotEmpty(t, sig1)
}
