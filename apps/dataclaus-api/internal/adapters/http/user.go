package http

import (
	"net/http"

	"apps/dataclaus-api/internal/adapters/http/validation"
	"apps/dataclaus-api/internal/core/domain"
	"apps/dataclaus-api/internal/core/ports"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// UserHandler handles HTTP requests for user operations.
type UserHandler struct {
	service ports.UserService
}

// NewUserHandler creates a new instance of UserHandler.
func NewUserHandler(service ports.UserService) *UserHandler {
	return &UserHandler{service: service}
}

// CreateUserRequest represents the request body for creating a user.
type CreateUserRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Name     string `json:"name" validate:"required,min=2,max=100"`
	Password string `json:"password" validate:"required,strong_password"`
}

// UserResponse represents the response body for user details.
type UserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func toUserResponse(u *domain.User) UserResponse {
	return UserResponse{
		ID:    u.ID.String(),
		Email: u.Email,
		Name:  u.Name,
	}
}

// Create handles the creation of a new user.
func (h *UserHandler) Create(c echo.Context) error {
	var req CreateUserRequest

	// Bind and validate the request in one step
	if err := validation.ValidateDTO(c, &req); err != nil {
		return err
	}

	user, err := h.service.Create(c.Request().Context(), req.Email, req.Name, req.Password)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, toUserResponse(user))
}

// Get handles retrieving a user by ID.
func (h *UserHandler) Get(c echo.Context) error {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid user id"})
	}

	user, err := h.service.Get(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "user not found"})
	}

	return c.JSON(http.StatusOK, toUserResponse(user))
}
