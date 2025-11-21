package apperror

import (
	"fmt"
	"net/http"
)

type AppError struct {
	Code int
	Message string
	Err error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s", e.Message, e.Err)
	}
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Err
}

func NewClientError(msg string, err error) *AppError {
	if err == nil {
		err = fmt.Errorf(msg)
	}
	return &AppError{
		Code:    http.StatusBadRequest,
		Message: msg,
		Err:     err,
	}
}

func NewInternalError(msg string, err error) *AppError {
	if err == nil {
		err = fmt.Errorf(msg)
	}
	return &AppError{
		Code:    http.StatusInternalServerError,
		Message: "Internal server error",
		Err:     err,
	}
}

func NewNotFoundError(resource string) *AppError {
	return &AppError{
		Code:    http.StatusNotFound,
		Message: fmt.Sprintf("Could not find %s.", resource),
		Err:     fmt.Errorf("Could not find %s.", resource),
	}
}