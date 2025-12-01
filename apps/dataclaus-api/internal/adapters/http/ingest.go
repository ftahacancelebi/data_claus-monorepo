package http

import (
	"encoding/json"
	"net/http"

	"apps/dataclaus-api/internal/adapters/http/validation"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/labstack/echo/v4"
)

// IngestHandler handles data ingestion requests.
type IngestHandler struct {
	producer ports.EventProducer
}

// NewIngestHandler creates a new instance of IngestHandler.
func NewIngestHandler(producer ports.EventProducer) *IngestHandler {
	return &IngestHandler{producer: producer}
}

// IngestRequest represents the payload for data ingestion.
// It's a generic map for now, as we accept raw JSON.
type IngestRequest struct {
	EventID   string                 `json:"event_id" validate:"required,uuid"`
	Timestamp int64                  `json:"timestamp" validate:"required,gt=0"`
	Type      string                 `json:"type" validate:"required"`
	Data      map[string]interface{} `json:"data" validate:"required"`
}

// Ingest handles the ingestion of raw data events.
func (h *IngestHandler) Ingest(c echo.Context) error {
	var req IngestRequest

	// Bind and validate
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	// Serialize to JSON for Kafka
	payload, err := json.Marshal(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to serialize event"})
	}

	// Publish to Kafka
	// We use the EventID as the key to ensure ordering for the same event if needed (though unlikely for unique IDs)
	// Or we could use a UserID/DeviceID if it were in the top level for partitioning.
	// For now, let's use EventID.
	if err := h.producer.Publish(c.Request().Context(), "ingest.raw_data", []byte(req.EventID), payload); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to publish event"})
	}

	return c.JSON(http.StatusAccepted, map[string]string{"status": "accepted", "event_id": req.EventID})
}
