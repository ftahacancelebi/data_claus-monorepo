package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"apps/dataclaus-api/internal/adapters/http/validation"
	"apps/dataclaus-api/internal/core/domain"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockDeveloperService struct {
	mock.Mock
}

func (m *MockDeveloperService) Register(ctx context.Context, name, email, password string) (*domain.Developer, error) {
	args := m.Called(ctx, name, email, password)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Developer), args.Error(1)
}

func (m *MockDeveloperService) Get(ctx context.Context, id uuid.UUID) (*domain.Developer, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Developer), args.Error(1)
}

func (m *MockDeveloperService) GetByEmail(ctx context.Context, email string) (*domain.Developer, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Developer), args.Error(1)
}

func (m *MockDeveloperService) UpdateUserShare(ctx context.Context, developerID uuid.UUID, userSharePercent int) (*domain.Developer, error) {
	args := m.Called(ctx, developerID, userSharePercent)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Developer), args.Error(1)
}

func TestDeveloperHandler_Register(t *testing.T) {
	mockDevService := new(MockDeveloperService)
	mockKeyService := new(MockAPIKeyService)
	handler := NewDeveloperHandler(mockDevService, mockKeyService)

	e := echo.New()
	body := `{"name":"Test Dev","email":"test@example.com","password":"Password123!"}`
	req := httptest.NewRequest(http.MethodPost, "/developers", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("validator", validation.NewValidator())

	dev := &domain.Developer{
		ID:    uuid.New(),
		Name:  "Test Dev",
		Email: "test@example.com",
	}
	mockDevService.On("Register", mock.Anything, "Test Dev", "test@example.com", "Password123!").Return(dev, nil)

	err := handler.Register(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)
	mockDevService.AssertExpectations(t)
}

func TestDeveloperHandler_Get(t *testing.T) {
	mockDevService := new(MockDeveloperService)
	mockKeyService := new(MockAPIKeyService)
	handler := NewDeveloperHandler(mockDevService, mockKeyService)

	e := echo.New()
	devID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/developers/"+devID.String(), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(devID.String())

	dev := &domain.Developer{
		ID:    devID,
		Name:  "Test Dev",
		Email: "test@example.com",
	}
	mockDevService.On("Get", mock.Anything, devID).Return(dev, nil)

	err := handler.Get(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	mockDevService.AssertExpectations(t)
}

func TestDeveloperHandler_GenerateAPIKey(t *testing.T) {
	mockDevService := new(MockDeveloperService)
	mockKeyService := new(MockAPIKeyService)
	handler := NewDeveloperHandler(mockDevService, mockKeyService)

	e := echo.New()
	devID := uuid.New()
	body := `{"name":"Production Key"}`
	req := httptest.NewRequest(http.MethodPost, "/developers/"+devID.String()+"/api-keys", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(devID.String())
	c.Set("validator", validation.NewValidator())

	apiKey := &domain.APIKey{
		ID:        uuid.New(),
		KeyPrefix: "abc12345",
		Name:      "Production Key",
		IsActive:  true,
	}
	mockKeyService.On("Generate", mock.Anything, devID, "Production Key").Return(apiKey, "full-raw-key", nil)

	err := handler.GenerateAPIKey(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)
	assert.Contains(t, rec.Body.String(), "full-raw-key")
	mockKeyService.AssertExpectations(t)
}

func TestDeveloperHandler_ListAPIKeys(t *testing.T) {
	mockDevService := new(MockDeveloperService)
	mockKeyService := new(MockAPIKeyService)
	handler := NewDeveloperHandler(mockDevService, mockKeyService)

	e := echo.New()
	devID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/developers/"+devID.String()+"/api-keys", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(devID.String())

	keys := []*domain.APIKey{
		{ID: uuid.New(), KeyPrefix: "key1", Name: "Key 1", IsActive: true},
		{ID: uuid.New(), KeyPrefix: "key2", Name: "Key 2", IsActive: false},
	}
	mockKeyService.On("GetByDeveloper", mock.Anything, devID).Return(keys, nil)

	err := handler.ListAPIKeys(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	mockKeyService.AssertExpectations(t)
}
