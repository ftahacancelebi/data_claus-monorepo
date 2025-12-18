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

type MockWalletService struct {
	mock.Mock
}

func (m *MockWalletService) Create(ctx context.Context, ownerID uuid.UUID, walletType, currency string) (*domain.Wallet, error) {
	args := m.Called(ctx, ownerID, walletType, currency)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Wallet), args.Error(1)
}

func (m *MockWalletService) Get(ctx context.Context, id uuid.UUID) (*domain.Wallet, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Wallet), args.Error(1)
}

func (m *MockWalletService) GetByOwner(ctx context.Context, ownerID uuid.UUID) ([]*domain.Wallet, error) {
	args := m.Called(ctx, ownerID)
	return args.Get(0).([]*domain.Wallet), args.Error(1)
}

func (m *MockWalletService) Credit(ctx context.Context, id uuid.UUID, amount float64) error {
	args := m.Called(ctx, id, amount)
	return args.Error(0)
}

func (m *MockWalletService) CreditPending(ctx context.Context, id uuid.UUID, amount float64) error {
	args := m.Called(ctx, id, amount)
	return args.Error(0)
}

func (m *MockWalletService) Debit(ctx context.Context, id uuid.UUID, amount float64) error {
	args := m.Called(ctx, id, amount)
	return args.Error(0)
}

func (m *MockWalletService) ReleasePendingIfThreshold(ctx context.Context, id uuid.UUID) (float64, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockWalletService) ProcessPendingReleases(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Get(0).(int), args.Error(1)
}

func TestWalletHandler_Create(t *testing.T) {
	mockService := new(MockWalletService)
	handler := NewWalletHandler(mockService)

	e := echo.New()
	ownerID := uuid.New()
	body := `{"owner_id":"` + ownerID.String() + `","type":"user","currency":"USD"}`
	req := httptest.NewRequest(http.MethodPost, "/wallets", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("validator", validation.NewValidator())

	wallet := &domain.Wallet{
		ID:             uuid.New(),
		OwnerID:        ownerID,
		Type:           "user",
		Currency:       "USD",
		Balance:        0,
		PendingBalance: 0,
	}
	mockService.On("Create", mock.Anything, ownerID, "user", "USD").Return(wallet, nil)

	err := handler.Create(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)
	mockService.AssertExpectations(t)
}

func TestWalletHandler_Get(t *testing.T) {
	mockService := new(MockWalletService)
	handler := NewWalletHandler(mockService)

	e := echo.New()
	walletID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/wallets/"+walletID.String(), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(walletID.String())

	wallet := &domain.Wallet{
		ID:             walletID,
		OwnerID:        uuid.New(),
		Type:           "user",
		Currency:       "USD",
		Balance:        100,
		PendingBalance: 0.005,
	}
	mockService.On("Get", mock.Anything, walletID).Return(wallet, nil)

	err := handler.Get(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	mockService.AssertExpectations(t)
}

func TestWalletHandler_Credit(t *testing.T) {
	mockService := new(MockWalletService)
	handler := NewWalletHandler(mockService)

	e := echo.New()
	walletID := uuid.New()
	body := `{"amount":100}`
	req := httptest.NewRequest(http.MethodPost, "/wallets/"+walletID.String()+"/credit", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(walletID.String())
	c.Set("validator", validation.NewValidator())

	mockService.On("Credit", mock.Anything, walletID, float64(100)).Return(nil)

	err := handler.Credit(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	mockService.AssertExpectations(t)
}

func TestWalletHandler_GetRevenueShares(t *testing.T) {
	mockService := new(MockWalletService)
	handler := NewWalletHandler(mockService)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/config/revenue-shares", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler.GetRevenueShares(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "user_share_percent")
	assert.Contains(t, rec.Body.String(), "developer_share_percent")
	assert.Contains(t, rec.Body.String(), "platform_fee_percent")
}

func TestWalletHandler_ReleasePending(t *testing.T) {
	mockService := new(MockWalletService)
	handler := NewWalletHandler(mockService)

	e := echo.New()
	walletID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/wallets/"+walletID.String()+"/release-pending", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(walletID.String())

	mockService.On("ReleasePendingIfThreshold", mock.Anything, walletID).Return(0.02, nil)

	err := handler.ReleasePending(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	mockService.AssertExpectations(t)
}
