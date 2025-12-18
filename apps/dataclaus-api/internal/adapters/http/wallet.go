package http

import (
	"net/http"

	"apps/dataclaus-api/internal/adapters/http/validation"
	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type WalletHandler struct {
	service ports.WalletService
}

func NewWalletHandler(service ports.WalletService) *WalletHandler {
	return &WalletHandler{service: service}
}

type CreateWalletRequest struct {
	OwnerID  string `json:"owner_id" validate:"required,uuid"`
	Type     string `json:"type" validate:"required,oneof=user developer buyer faucet platform"`
	Currency string `json:"currency" validate:"required,len=3"`
}

type WalletResponse struct {
	ID             string  `json:"id"`
	OwnerID        string  `json:"owner_id"`
	Type           string  `json:"type"`
	Balance        float64 `json:"balance"`
	PendingBalance float64 `json:"pending_balance"`
	Currency       string  `json:"currency"`
	CreatedAt      string  `json:"created_at"`
}

type UpdateBalanceRequest struct {
	Amount float64 `json:"amount" validate:"required,gt=0"`
}

type RevenueShareResponse struct {
	UserSharePercent      int     `json:"user_share_percent"`
	DeveloperSharePercent int     `json:"developer_share_percent"`
	PlatformFeePercent    int     `json:"platform_fee_percent"`
	MinPayoutThreshold    float64 `json:"min_payout_threshold"`
}

func (h *WalletHandler) Create(c echo.Context) error {
	var req CreateWalletRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	ownerID, _ := uuid.Parse(req.OwnerID)
	wallet, err := h.service.Create(c.Request().Context(), ownerID, req.Type, req.Currency)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, WalletResponse{
		ID:             wallet.ID.String(),
		OwnerID:        wallet.OwnerID.String(),
		Type:           wallet.Type,
		Balance:        wallet.Balance,
		PendingBalance: wallet.PendingBalance,
		Currency:       wallet.Currency,
		CreatedAt:      wallet.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *WalletHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid wallet id"})
	}

	wallet, err := h.service.Get(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "wallet not found"})
	}

	return c.JSON(http.StatusOK, WalletResponse{
		ID:             wallet.ID.String(),
		OwnerID:        wallet.OwnerID.String(),
		Type:           wallet.Type,
		Balance:        wallet.Balance,
		PendingBalance: wallet.PendingBalance,
		Currency:       wallet.Currency,
		CreatedAt:      wallet.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *WalletHandler) GetByOwner(c echo.Context) error {
	ownerID, err := uuid.Parse(c.Param("ownerId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid owner id"})
	}

	wallets, err := h.service.GetByOwner(c.Request().Context(), ownerID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := make([]WalletResponse, len(wallets))
	for i, w := range wallets {
		response[i] = WalletResponse{
			ID:             w.ID.String(),
			OwnerID:        w.OwnerID.String(),
			Type:           w.Type,
			Balance:        w.Balance,
			PendingBalance: w.PendingBalance,
			Currency:       w.Currency,
			CreatedAt:      w.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	return c.JSON(http.StatusOK, response)
}

func (h *WalletHandler) Credit(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid wallet id"})
	}

	var req UpdateBalanceRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	if err := h.service.Credit(c.Request().Context(), id, req.Amount); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "credited"})
}

func (h *WalletHandler) Debit(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid wallet id"})
	}

	var req UpdateBalanceRequest
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	if err := h.service.Debit(c.Request().Context(), id, req.Amount); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "debited"})
}

// GetRevenueShares returns the current revenue sharing configuration
// Note: User share is now developer-configurable (50-90%), this returns defaults
func (h *WalletHandler) GetRevenueShares(c echo.Context) error {
	defaultDevShare := 100 - domain.PlatformFeePercent - domain.DefaultUserSharePercent
	return c.JSON(http.StatusOK, RevenueShareResponse{
		UserSharePercent:      domain.DefaultUserSharePercent,
		DeveloperSharePercent: defaultDevShare,
		PlatformFeePercent:    domain.PlatformFeePercent,
		MinPayoutThreshold:    domain.MinPayoutThreshold,
	})
}

// ReleasePending releases pending balance to available if threshold is met
func (h *WalletHandler) ReleasePending(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid wallet id"})
	}

	released, err := h.service.ReleasePendingIfThreshold(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":   "processed",
		"released": released,
	})
}
