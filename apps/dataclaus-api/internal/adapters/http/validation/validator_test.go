package validation

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type TestDTO struct {
	Email        string `json:"email" validate:"required,email"`
	Name         string `json:"name" validate:"required,min=2,max=50"`
	Age          int    `json:"age" validate:"omitempty,gte=0,lte=150"`
	Password     string `json:"password" validate:"required,strong_password"`
	Website      string `json:"website" validate:"omitempty,url"`
	PhoneNumber  string `json:"phone_number" validate:"omitempty,len=10,numeric"`
	ConfirmEmail string `json:"confirm_email" validate:"required,eqfield=Email"`
}

func TestValidator_Validate_Success(t *testing.T) {
	validator := NewValidator()

	dto := TestDTO{
		Email:        "test@example.com",
		Name:         "John Doe",
		Age:          25,
		Password:     "SecurePass123!",
		Website:      "https://example.com",
		PhoneNumber:  "1234567890",
		ConfirmEmail: "test@example.com",
	}

	err := validator.Validate(dto)
	assert.NoError(t, err)
}

func TestValidator_Validate_RequiredFields(t *testing.T) {
	validator := NewValidator()

	tests := []struct {
		name          string
		dto           TestDTO
		expectedField string
		expectedTag   string
	}{
		{
			name: "missing email",
			dto: TestDTO{
				Name:         "John Doe",
				Age:          25,
				Password:     "SecurePass123!",
				ConfirmEmail: "",
			},
			expectedField: "email",
			expectedTag:   "required",
		},
		{
			name: "missing name",
			dto: TestDTO{
				Email:        "test@example.com",
				Age:          25,
				Password:     "SecurePass123!",
				ConfirmEmail: "test@example.com",
			},
			expectedField: "name",
			expectedTag:   "required",
		},
		{
			name: "missing password",
			dto: TestDTO{
				Email:        "test@example.com",
				Name:         "John Doe",
				Age:          25,
				ConfirmEmail: "test@example.com",
			},
			expectedField: "password",
			expectedTag:   "required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.Validate(tt.dto)
			require.Error(t, err)

			ve, ok := IsValidationError(err)
			require.True(t, ok, "error should be a ValidationError")
			assert.True(t, ve.HasField(tt.expectedField))

			fieldErr := ve.GetFieldError(tt.expectedField)
			require.NotNil(t, fieldErr)
			assert.Equal(t, tt.expectedTag, fieldErr.Tag)
		})
	}
}

func TestValidator_Validate_EmailFormat(t *testing.T) {
	validator := NewValidator()

	tests := []struct {
		name       string
		email      string
		shouldFail bool
	}{
		{"valid email", "test@example.com", false},
		{"valid email with subdomain", "user@mail.example.com", false},
		{"invalid email - no @", "testexample.com", true},
		{"invalid email - no domain", "test@", true},
		{"invalid email - no user", "@example.com", true},
		{"invalid email - spaces", "test @example.com", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dto := TestDTO{
				Email:        tt.email,
				Name:         "John Doe",
				Age:          25,
				Password:     "SecurePass123!",
				ConfirmEmail: tt.email,
			}

			err := validator.Validate(dto)

			if tt.shouldFail {
				require.Error(t, err)
				ve, ok := IsValidationError(err)
				require.True(t, ok)
				assert.True(t, ve.HasField("email"))
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidator_Validate_StringLength(t *testing.T) {
	validator := NewValidator()

	tests := []struct {
		name        string
		nameValue   string
		shouldFail  bool
		expectedTag string
	}{
		{"valid name - min length", "Jo", false, ""},
		{"valid name - normal length", "John Doe", false, ""},
		{"valid name - max length", "John Doe with a very long name that is fifty chars", false, ""},
		{"invalid name - too short", "J", true, "min"},
		{"invalid name - too long", "John Doe with a name that exceeds the maximum allowed", true, "max"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dto := TestDTO{
				Email:        "test@example.com",
				Name:         tt.nameValue,
				Age:          25,
				Password:     "SecurePass123!",
				ConfirmEmail: "test@example.com",
			}

			err := validator.Validate(dto)

			if tt.shouldFail {
				require.Error(t, err)
				ve, ok := IsValidationError(err)
				require.True(t, ok)
				assert.True(t, ve.HasField("name"))

				fieldErr := ve.GetFieldError("name")
				require.NotNil(t, fieldErr)
				assert.Equal(t, tt.expectedTag, fieldErr.Tag)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidator_Validate_NumericRange(t *testing.T) {
	validator := NewValidator()

	tests := []struct {
		name        string
		age         int
		shouldFail  bool
		expectedTag string
	}{
		{"valid age - minimum", 0, false, ""},
		{"valid age - normal", 25, false, ""},
		{"valid age - maximum", 150, false, ""},
		{"invalid age - negative", -1, true, "gte"},
		{"invalid age - too high", 151, true, "lte"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dto := TestDTO{
				Email:        "test@example.com",
				Name:         "John Doe",
				Age:          tt.age,
				Password:     "SecurePass123!",
				ConfirmEmail: "test@example.com",
			}

			err := validator.Validate(dto)

			if tt.shouldFail {
				require.Error(t, err)
				ve, ok := IsValidationError(err)
				require.True(t, ok)
				assert.True(t, ve.HasField("age"))

				fieldErr := ve.GetFieldError("age")
				require.NotNil(t, fieldErr)
				assert.Equal(t, tt.expectedTag, fieldErr.Tag)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidator_Validate_StrongPassword(t *testing.T) {
	validator := NewValidator()

	tests := []struct {
		name       string
		password   string
		shouldFail bool
	}{
		{"valid strong password", "SecurePass123!", false},
		{"valid with multiple special chars", "P@ssw0rd!#$", false},
		{"invalid - too short", "Pass1!", true},
		{"invalid - no uppercase", "password123!", true},
		{"invalid - no lowercase", "PASSWORD123!", true},
		{"invalid - no number", "Password!@#", true},
		{"invalid - no special char", "Password123", true},
		{"invalid - only letters", "PasswordOnly", true},
		{"invalid - only numbers", "12345678", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dto := TestDTO{
				Email:        "test@example.com",
				Name:         "John Doe",
				Age:          25,
				Password:     tt.password,
				ConfirmEmail: "test@example.com",
			}

			err := validator.Validate(dto)

			if tt.shouldFail {
				require.Error(t, err)
				ve, ok := IsValidationError(err)
				require.True(t, ok)
				assert.True(t, ve.HasField("password"))

				fieldErr := ve.GetFieldError("password")
				require.NotNil(t, fieldErr)
				assert.Equal(t, "strong_password", fieldErr.Tag)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidator_Validate_URL(t *testing.T) {
	validator := NewValidator()

	tests := []struct {
		name       string
		website    string
		shouldFail bool
	}{
		{"valid https URL", "https://example.com", false},
		{"valid http URL", "http://example.com", false},
		{"valid URL with path", "https://example.com/path/to/page", false},
		{"empty (omitempty)", "", false},
		{"invalid URL - no protocol", "example.com", true},
		{"invalid URL - malformed", "not a url at all", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dto := TestDTO{
				Email:        "test@example.com",
				Name:         "John Doe",
				Age:          25,
				Password:     "SecurePass123!",
				Website:      tt.website,
				ConfirmEmail: "test@example.com",
			}

			err := validator.Validate(dto)

			if tt.shouldFail {
				require.Error(t, err)
				ve, ok := IsValidationError(err)
				require.True(t, ok)
				assert.True(t, ve.HasField("website"))
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidator_Validate_MultipleErrors(t *testing.T) {
	validator := NewValidator()

	dto := TestDTO{
		Email:    "invalid-email",
		Name:     "J",
		Age:      200,
		Password: "weak",
	}

	err := validator.Validate(dto)
	require.Error(t, err)

	ve, ok := IsValidationError(err)
	require.True(t, ok)

	// Should have multiple validation errors
	assert.Greater(t, ve.Count(), 1)

	// Check specific fields
	assert.True(t, ve.HasField("email"))
	assert.True(t, ve.HasField("name"))
	assert.True(t, ve.HasField("age"))
	assert.True(t, ve.HasField("password"))
}

func TestValidationError_Methods(t *testing.T) {
	ve := &ValidationError{
		Errors: []FieldError{
			{Field: "email", Message: "email is required", Tag: "required"},
			{Field: "name", Message: "name must be at least 2 characters", Tag: "min"},
			{Field: "email", Message: "email must be valid", Tag: "email"},
		},
	}

	// Test Count
	assert.Equal(t, 3, ve.Count())

	// Test HasField
	assert.True(t, ve.HasField("email"))
	assert.True(t, ve.HasField("name"))
	assert.False(t, ve.HasField("password"))

	// Test GetFieldError (returns first error for field)
	emailErr := ve.GetFieldError("email")
	require.NotNil(t, emailErr)
	assert.Equal(t, "required", emailErr.Tag)

	// Test GetFieldErrors (returns all errors for field)
	emailErrs := ve.GetFieldErrors("email")
	assert.Len(t, emailErrs, 2)

	// Test Error message
	assert.Contains(t, ve.Error(), "3 errors")
}

func TestValidationError_SingleError(t *testing.T) {
	ve := &ValidationError{
		Errors: []FieldError{
			{Field: "email", Message: "email is required", Tag: "required"},
		},
	}

	// Single error should return the message directly
	assert.Equal(t, "email is required", ve.Error())
}

func TestValidateVar(t *testing.T) {
	validator := NewValidator()

	// Test valid email
	err := validator.ValidateVar("test@example.com", "required,email")
	assert.NoError(t, err)

	// Test invalid email
	err = validator.ValidateVar("invalid-email", "required,email")
	require.Error(t, err)

	ve, ok := IsValidationError(err)
	require.True(t, ok)
	assert.Greater(t, ve.Count(), 0)
}
