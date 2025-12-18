package http

import (
	"net/http"
	"strconv"

	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type LedgerHandler struct {
	service ports.LedgerService
}

func NewLedgerHandler(service ports.LedgerService) *LedgerHandler {
	return &LedgerHandler{service: service}
}

type TransactionResponse struct {
	ID             string  `json:"id"`
	SourceWalletID string  `json:"source_wallet_id"`
	DestWalletID   string  `json:"dest_wallet_id"`
	Amount         float64 `json:"amount"`
	Currency       string  `json:"currency"`
	ReferenceID    string  `json:"reference_id"`
	Type           string  `json:"type"`
	Status         string  `json:"status"`
	CreatedAt      string  `json:"created_at"`
}

func (h *LedgerHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid transaction id"})
	}

	tx, err := h.service.Get(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "transaction not found"})
	}

	return c.JSON(http.StatusOK, TransactionResponse{
		ID:             tx.ID.String(),
		SourceWalletID: tx.SourceWalletID.String(),
		DestWalletID:   tx.DestWalletID.String(),
		Amount:         tx.Amount,
		Currency:       tx.Currency,
		ReferenceID:    tx.ReferenceID.String(),
		Type:           tx.Type,
		Status:         tx.Status,
		CreatedAt:      tx.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *LedgerHandler) GetAll(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	offset, _ := strconv.Atoi(c.QueryParam("offset"))

	if limit <= 0 {
		limit = 20
	}

	txs, err := h.service.GetAll(c.Request().Context(), limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := make([]TransactionResponse, len(txs))
	for i, tx := range txs {
		response[i] = TransactionResponse{
			ID:             tx.ID.String(),
			SourceWalletID: tx.SourceWalletID.String(),
			DestWalletID:   tx.DestWalletID.String(),
			Amount:         tx.Amount,
			Currency:       tx.Currency,
			ReferenceID:    tx.ReferenceID.String(),
			Type:           tx.Type,
			Status:         tx.Status,
			CreatedAt:      tx.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	return c.JSON(http.StatusOK, response)
}

func (h *LedgerHandler) GetByWallet(c echo.Context) error {
	walletID, err := uuid.Parse(c.Param("walletId"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid wallet id"})
	}

	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	offset, _ := strconv.Atoi(c.QueryParam("offset"))

	if limit <= 0 {
		limit = 20
	}

	txs, err := h.service.GetByWallet(c.Request().Context(), walletID, limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := make([]TransactionResponse, len(txs))
	for i, tx := range txs {
		response[i] = TransactionResponse{
			ID:             tx.ID.String(),
			SourceWalletID: tx.SourceWalletID.String(),
			DestWalletID:   tx.DestWalletID.String(),
			Amount:         tx.Amount,
			Currency:       tx.Currency,
			ReferenceID:    tx.ReferenceID.String(),
			Type:           tx.Type,
			Status:         tx.Status,
			CreatedAt:      tx.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	return c.JSON(http.StatusOK, response)
}
