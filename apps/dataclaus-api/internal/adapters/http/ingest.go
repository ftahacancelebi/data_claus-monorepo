package http

import (
	"encoding/json"
	"fmt"
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

// IngestRequest represents the payload for single data ingestion.
type IngestRequest struct {
	EventID     string                 `json:"event_id" validate:"required"`
	DeveloperID string                 `json:"developer_id" validate:"required"`
	UserID      string                 `json:"user_id" validate:"required"`
	EventType   string                 `json:"event_type" validate:"required"`
	Timestamp   string                 `json:"timestamp" validate:"required"`
	Payload     map[string]interface{} `json:"payload" validate:"required"`
	SessionID   string                 `json:"session_id,omitempty"`
	CampaignID  string                 `json:"campaign_id,omitempty"`
	Device      map[string]interface{} `json:"device,omitempty"`
}

// BatchIngestRequest represents the payload for batch data ingestion.
type BatchIngestRequest struct {
	Events  []IngestRequest `json:"events" validate:"required,min=1,dive"`
	Session *SessionInfo    `json:"session,omitempty"`
}

// SessionInfo represents session metadata.
type SessionInfo struct {
	SessionID     string `json:"session_id"`
	StartTime     string `json:"start_time"`
	ActiveSeconds int    `json:"active_seconds"`
}

// Ingest handles the ingestion of a single raw data event.
func (h *IngestHandler) Ingest(c echo.Context) error {
	var req IngestRequest

	// Bind and validate
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	// Just for demo purposes: Log the incoming request
	fmt.Printf("[Ingest] Event: %s, User: %s, Type: %s, Payload: %+v\n", 
		req.EventID, req.UserID, req.EventType, req.Payload)

	// Serialize to JSON for Kafka
	payload, err := json.Marshal(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to serialize event"})
	}

	// Publish to Kafka
	if err := h.producer.Publish(c.Request().Context(), "ingest.raw_data", []byte(req.EventID), payload); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to publish event"})
	}

	return c.JSON(http.StatusAccepted, map[string]string{
		"status":   "accepted",
		"event_id": req.EventID,
	})
}

// IngestBatch handles the ingestion of multiple data events in a single request.
func (h *IngestHandler) IngestBatch(c echo.Context) error {
	var req BatchIngestRequest

	// Bind and validate
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	fmt.Printf("[IngestBatch] Received %d events. First event: %+v\n", len(req.Events), req.Events[0])

	successCount := 0
	errors := make([]map[string]string, 0)

	for _, event := range req.Events {
		// Serialize to JSON for Kafka
		payload, err := json.Marshal(event)
		if err != nil {
			errors = append(errors, map[string]string{
				"event_id": event.EventID,
				"error":    "failed to serialize event",
			})
			continue
		}

		// Publish to Kafka
		if err := h.producer.Publish(c.Request().Context(), "ingest.raw_data", []byte(event.EventID), payload); err != nil {
			errors = append(errors, map[string]string{
				"event_id": event.EventID,
				"error":    "failed to publish event",
			})
			continue
		}

		successCount++
	}

	response := map[string]interface{}{
		"status":          "accepted",
		"total_events":    len(req.Events),
		"success_count":   successCount,
		"failed_count":    len(errors),
	}

	if len(errors) > 0 {
		response["errors"] = errors
	}

	return c.JSON(http.StatusAccepted, response)
}

