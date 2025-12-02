package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockProducer is a mock implementation of ports.EventProducer
type MockProducer struct {
	mock.Mock
}

func (m *MockProducer) Publish(ctx context.Context, topic string, key []byte, value []byte) error {
	args := m.Called(ctx, topic, key, value)
	return args.Error(0)
}

func (m *MockProducer) Close() error {
	args := m.Called()
	return args.Error(0)
}

func TestIngestHandler_Ingest(t *testing.T) {
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler
	ApplyMiddlewares(e) // Apply validation middleware

	mockProducer := new(MockProducer)
	handler := NewIngestHandler(mockProducer)

	t.Run("successful ingest", func(t *testing.T) {
		reqBody := `{"event_id": "550e8400-e29b-41d4-a716-446655440000", "timestamp": 1678900000, "type": "click", "data": {"x": 10, "y": 20}}`
		req := httptest.NewRequest(http.MethodPost, "/v1/ingest", strings.NewReader(reqBody))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)

		// Expect publish call
		mockProducer.On("Publish", mock.Anything, "ingest.raw_data", []byte("550e8400-e29b-41d4-a716-446655440000"), mock.Anything).Return(nil).Once()

		err := handler.Ingest(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusAccepted, rec.Code)
	})

	t.Run("validation error", func(t *testing.T) {
		reqBody := `{"event_id": "invalid-uuid", "timestamp": 0}`
		req := httptest.NewRequest(http.MethodPost, "/v1/ingest", strings.NewReader(reqBody))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)

		err := handler.Ingest(c)
		assert.Error(t, err)

		// Manually invoke error handler to verify response
		e.HTTPErrorHandler(err, c)

		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	})
}
