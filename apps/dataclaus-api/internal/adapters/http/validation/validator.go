package validation

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

// Validator wraps the validator instance and provides custom validation logic.
type Validator struct {
	validate *validator.Validate
}

// NewValidator creates and configures a new validator instance.
func NewValidator() *Validator {
	v := validator.New()

	// Register custom tag name function to use JSON tags for field names in errors
	v.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "-" {
			return ""
		}
		return name
	})

	// Register custom validators here
	v.RegisterValidation("strong_password", validateStrongPassword)

	return &Validator{validate: v}
}

// Validate validates a struct and returns formatted validation errors.
func (v *Validator) Validate(i interface{}) error {
	if err := v.validate.Struct(i); err != nil {
		if validationErrs, ok := err.(validator.ValidationErrors); ok {
			return NewValidationError(validationErrs)
		}
		return err
	}
	return nil
}

// validateStrongPassword is a custom validator for strong passwords.
// A strong password must:
// - Be at least 8 characters long
// - Contain at least one uppercase letter
// - Contain at least one lowercase letter
// - Contain at least one digit
func validateStrongPassword(fl validator.FieldLevel) bool {
	password := fl.Field().String()

	if len(password) < 8 {
		return false
	}

	var (
		hasUpper   bool
		hasLower   bool
		hasNumber  bool
		hasSpecial bool
	)

	for _, char := range password {
		switch {
		case 'A' <= char && char <= 'Z':
			hasUpper = true
		case 'a' <= char && char <= 'z':
			hasLower = true
		case '0' <= char && char <= '9':
			hasNumber = true
		case strings.ContainsRune("!@#$%^&*()_+-=[]{}|;:,.<>?", char):
			hasSpecial = true
		}
	}

	return hasUpper && hasLower && hasNumber && hasSpecial
}

// ValidateVar validates a single variable against a tag.
func (v *Validator) ValidateVar(field interface{}, tag string) error {
	if err := v.validate.Var(field, tag); err != nil {
		if validationErrs, ok := err.(validator.ValidationErrors); ok {
			return NewValidationError(validationErrs)
		}
		return err
	}
	return nil
}

// RegisterValidation adds a custom validation function.
func (v *Validator) RegisterValidation(tag string, fn validator.Func, callValidationEvenIfNull ...bool) error {
	return v.validate.RegisterValidation(tag, fn, callValidationEvenIfNull...)
}

// getFieldName extracts the JSON field name or falls back to the struct field name.
func getFieldName(fe validator.FieldError) string {
	return fe.Field()
}

// getErrorMessage generates a human-friendly error message based on the validation tag.
func getErrorMessage(fe validator.FieldError) string {
	fieldName := getFieldName(fe)

	switch fe.Tag() {
	case "required":
		return fmt.Sprintf("%s is required", fieldName)
	case "email":
		return fmt.Sprintf("%s must be a valid email address", fieldName)
	case "min":
		return fmt.Sprintf("%s must be at least %s characters long", fieldName, fe.Param())
	case "max":
		return fmt.Sprintf("%s must not exceed %s characters", fieldName, fe.Param())
	case "gte":
		return fmt.Sprintf("%s must be greater than or equal to %s", fieldName, fe.Param())
	case "lte":
		return fmt.Sprintf("%s must be less than or equal to %s", fieldName, fe.Param())
	case "gt":
		return fmt.Sprintf("%s must be greater than %s", fieldName, fe.Param())
	case "lt":
		return fmt.Sprintf("%s must be less than %s", fieldName, fe.Param())
	case "len":
		return fmt.Sprintf("%s must be exactly %s characters long", fieldName, fe.Param())
	case "alpha":
		return fmt.Sprintf("%s must contain only alphabetic characters", fieldName)
	case "alphanum":
		return fmt.Sprintf("%s must contain only alphanumeric characters", fieldName)
	case "numeric":
		return fmt.Sprintf("%s must be a valid numeric value", fieldName)
	case "url":
		return fmt.Sprintf("%s must be a valid URL", fieldName)
	case "uuid":
		return fmt.Sprintf("%s must be a valid UUID", fieldName)
	case "oneof":
		return fmt.Sprintf("%s must be one of [%s]", fieldName, fe.Param())
	case "eqfield":
		return fmt.Sprintf("%s must be equal to %s", fieldName, fe.Param())
	case "nefield":
		return fmt.Sprintf("%s must not be equal to %s", fieldName, fe.Param())
	case "strong_password":
		return fmt.Sprintf("%s must be at least 8 characters and include uppercase, lowercase, number, and special character", fieldName)
	default:
		return fmt.Sprintf("%s failed validation on '%s' tag", fieldName, fe.Tag())
	}
}
