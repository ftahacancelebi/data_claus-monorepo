package http

import (
	"net/http"

	"apps/dataclaus-api/internal/adapters/http/validation"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type CampaignHandler struct {
	service ports.CampaignService
}

func NewCampaignHandler(service ports.CampaignService) *CampaignHandler {
	return &CampaignHandler{service: service}
}

type CreateCampaignRequest struct {
	BuyerID string  `json:"buyer_id" validate:"required,uuid"`
	Name    string  `json:"name" validate:"required,min=2,max=200"`
	Budget  float64 `json:"budget" validate:"required,gt=0"`
}

type UpdateCampaignStatusRequest struct {
	Status string `json:"status" validate:"required,oneof=active paused completed"`
}

type CampaignResponse struct {
	ID          string  `json:"id"`
	BuyerID     string  `json:"buyer_id"`
	Name        string  `json:"name"`
	TotalBudget float64 `json:"total_budget"`
	Remaining   float64 `json:"remaining"`
	Status      string  `json:"status"`
	CreatedAt   string  `json:"created_at"`
}

func (h *CampaignHandler) Create(c echo.Context) error {
	var req CreateCampaignRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	buyerID, _ := uuid.Parse(req.BuyerID)
	campaign, err := h.service.Create(c.Request().Context(), buyerID, req.Name, req.Budget)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, CampaignResponse{
		ID:          campaign.ID.String(),
		BuyerID:     campaign.BuyerID.String(),
		Name:        campaign.Name,
		TotalBudget: campaign.TotalBudget,
		Remaining:   campaign.Remaining,
		Status:      campaign.Status,
		CreatedAt:   campaign.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *CampaignHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid campaign id"})
	}

	campaign, err := h.service.Get(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "campaign not found"})
	}

	return c.JSON(http.StatusOK, CampaignResponse{
		ID:          campaign.ID.String(),
		BuyerID:     campaign.BuyerID.String(),
		Name:        campaign.Name,
		TotalBudget: campaign.TotalBudget,
		Remaining:   campaign.Remaining,
		Status:      campaign.Status,
		CreatedAt:   campaign.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *CampaignHandler) GetActive(c echo.Context) error {
	campaigns, err := h.service.GetActive(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := make([]CampaignResponse, len(campaigns))
	for i, camp := range campaigns {
		response[i] = CampaignResponse{
			ID:          camp.ID.String(),
			BuyerID:     camp.BuyerID.String(),
			Name:        camp.Name,
			TotalBudget: camp.TotalBudget,
			Remaining:   camp.Remaining,
			Status:      camp.Status,
			CreatedAt:   camp.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	return c.JSON(http.StatusOK, response)
}

func (h *CampaignHandler) GetByBuyer(c echo.Context) error {
	buyerID, err := uuid.Parse(c.Param("buyerId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid buyer id"})
	}

	campaigns, err := h.service.GetByBuyer(c.Request().Context(), buyerID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := make([]CampaignResponse, len(campaigns))
	for i, camp := range campaigns {
		response[i] = CampaignResponse{
			ID:          camp.ID.String(),
			BuyerID:     camp.BuyerID.String(),
			Name:        camp.Name,
			TotalBudget: camp.TotalBudget,
			Remaining:   camp.Remaining,
			Status:      camp.Status,
			CreatedAt:   camp.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	return c.JSON(http.StatusOK, response)
}

func (h *CampaignHandler) UpdateStatus(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid campaign id"})
	}

	var req UpdateCampaignStatusRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	if err := h.service.UpdateStatus(c.Request().Context(), id, req.Status); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "updated"})
}
