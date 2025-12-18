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

type MockCampaignService struct {
	mock.Mock
}

func (m *MockCampaignService) Create(ctx context.Context, buyerID uuid.UUID, name string, budget float64) (*domain.Campaign, error) {
	args := m.Called(ctx, buyerID, name, budget)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Campaign), args.Error(1)
}

func (m *MockCampaignService) Get(ctx context.Context, id uuid.UUID) (*domain.Campaign, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Campaign), args.Error(1)
}

func (m *MockCampaignService) GetActive(ctx context.Context) ([]*domain.Campaign, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*domain.Campaign), args.Error(1)
}

func (m *MockCampaignService) GetByBuyer(ctx context.Context, buyerID uuid.UUID) ([]*domain.Campaign, error) {
	args := m.Called(ctx, buyerID)
	return args.Get(0).([]*domain.Campaign), args.Error(1)
}

func (m *MockCampaignService) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	args := m.Called(ctx, id, status)
	return args.Error(0)
}

func (m *MockCampaignService) DeductBudget(ctx context.Context, id uuid.UUID, amount float64) error {
	args := m.Called(ctx, id, amount)
	return args.Error(0)
}

func TestCampaignHandler_Create(t *testing.T) {
	mockService := new(MockCampaignService)
	handler := NewCampaignHandler(mockService)

	e := echo.New()
	buyerID := uuid.New()
	body := `{"buyer_id":"` + buyerID.String() + `","name":"Test Campaign","budget":1000}`
	req := httptest.NewRequest(http.MethodPost, "/campaigns", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("validator", validation.NewValidator())

	campaign := &domain.Campaign{
		ID:          uuid.New(),
		BuyerID:     buyerID,
		Name:        "Test Campaign",
		TotalBudget: 1000,
		Remaining:   1000,
		Status:      "active",
	}
	mockService.On("Create", mock.Anything, buyerID, "Test Campaign", float64(1000)).Return(campaign, nil)

	err := handler.Create(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)
	mockService.AssertExpectations(t)
}

func TestCampaignHandler_GetActive(t *testing.T) {
	mockService := new(MockCampaignService)
	handler := NewCampaignHandler(mockService)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/campaigns", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	campaigns := []*domain.Campaign{
		{ID: uuid.New(), Name: "Campaign 1", Status: "active"},
		{ID: uuid.New(), Name: "Campaign 2", Status: "active"},
	}
	mockService.On("GetActive", mock.Anything).Return(campaigns, nil)

	err := handler.GetActive(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	mockService.AssertExpectations(t)
}

func TestCampaignHandler_UpdateStatus(t *testing.T) {
	mockService := new(MockCampaignService)
	handler := NewCampaignHandler(mockService)

	e := echo.New()
	campaignID := uuid.New()
	body := `{"status":"paused"}`
	req := httptest.NewRequest(http.MethodPatch, "/campaigns/"+campaignID.String()+"/status", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(campaignID.String())
	c.Set("validator", validation.NewValidator())

	mockService.On("UpdateStatus", mock.Anything, campaignID, "paused").Return(nil)

	err := handler.UpdateStatus(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	mockService.AssertExpectations(t)
}
