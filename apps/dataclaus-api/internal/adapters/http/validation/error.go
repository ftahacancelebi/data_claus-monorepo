package validation

import (
	"fmt"

	"github.com/go-playground/validator/v10"
)

// ValidationError represents a collection of validation errors.
type ValidationError struct {
	Errors []FieldError `json:"errors"`
}

// FieldError represents a single field validation error.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Tag     string `json:"tag,omitempty"`
	Value   string `json:"value,omitempty"`
}

// Error implements the error interface.
func (ve *ValidationError) Error() string {
	if len(ve.Errors) == 0 {
		return "validation error"
	}

	if len(ve.Errors) == 1 {
		return ve.Errors[0].Message
	}

	return fmt.Sprintf("validation failed: %d errors", len(ve.Errors))
}

// NewValidationError creates a ValidationError from validator.ValidationErrors.
func NewValidationError(errs validator.ValidationErrors) *ValidationError {
	fieldErrors := make([]FieldError, 0, len(errs))

	for _, err := range errs {
		fieldErrors = append(fieldErrors, FieldError{
			Field:   getFieldName(err),
			Message: getErrorMessage(err),
			Tag:     err.Tag(),
			Value:   fmt.Sprintf("%v", err.Value()),
		})
	}

	return &ValidationError{
		Errors: fieldErrors,
	}
}

// HasField checks if the validation error contains an error for a specific field.
func (ve *ValidationError) HasField(field string) bool {
	for _, err := range ve.Errors {
		if err.Field == field {
			return true
		}
	}
	return false
}

// GetFieldError returns the first error for a specific field.
func (ve *ValidationError) GetFieldError(field string) *FieldError {
	for _, err := range ve.Errors {
		if err.Field == field {
			return &err
		}
	}
	return nil
}

// GetFieldErrors returns all errors for a specific field.
func (ve *ValidationError) GetFieldErrors(field string) []FieldError {
	var errors []FieldError
	for _, err := range ve.Errors {
		if err.Field == field {
			errors = append(errors, err)
		}
	}
	return errors
}

// Count returns the number of validation errors.
func (ve *ValidationError) Count() int {
	return len(ve.Errors)
}

// IsValidationError checks if an error is a ValidationError.
func IsValidationError(err error) (*ValidationError, bool) {
	if err == nil {
		return nil, false
	}

	ve, ok := err.(*ValidationError)
	return ve, ok
}
