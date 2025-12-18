package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCalculatePayout(t *testing.T) {
	tests := []struct {
		name             string
		qualityScore     float64
		activeSeconds    int64
		hourlyRate       float64
		userSharePercent int
		expectedTotal    float64
		expectedUser     float64
		expectedDev      float64
		expectedFee      float64
	}{
		{
			name:             "100% quality, 1 hour, default 70% user share",
			qualityScore:     1.0,
			activeSeconds:    3600,
			hourlyRate:       0.10,
			userSharePercent: 70,
			expectedTotal:    0.10,
			expectedUser:     0.07,   // 70%
			expectedDev:      0.025,  // 25% (100 - 5 - 70)
			expectedFee:      0.005,  // 5%
		},
		{
			name:             "100% quality, 1 hour, generous 85% user share",
			qualityScore:     1.0,
			activeSeconds:    3600,
			hourlyRate:       0.10,
			userSharePercent: 85,
			expectedTotal:    0.10,
			expectedUser:     0.085,  // 85%
			expectedDev:      0.01,   // 10% (100 - 5 - 85)
			expectedFee:      0.005,  // 5%
		},
		{
			name:             "50% quality, 1 hour",
			qualityScore:     0.5,
			activeSeconds:    3600,
			hourlyRate:       0.10,
			userSharePercent: 70,
			expectedTotal:    0.05,
			expectedUser:     0.035,  // 70%
			expectedDev:      0.0125, // 25%
			expectedFee:      0.0025, // 5%
		},
		{
			name:             "100% quality, 30 minutes",
			qualityScore:     1.0,
			activeSeconds:    1800,
			hourlyRate:       0.10,
			userSharePercent: 70,
			expectedTotal:    0.05,
			expectedUser:     0.035,
			expectedDev:      0.0125,
			expectedFee:      0.0025,
		},
		{
			name:             "zero quality",
			qualityScore:     0,
			activeSeconds:    3600,
			hourlyRate:       0.10,
			userSharePercent: 70,
			expectedTotal:    0,
			expectedUser:     0,
			expectedDev:      0,
			expectedFee:      0,
		},
		{
			name:             "zero time",
			qualityScore:     1.0,
			activeSeconds:    0,
			hourlyRate:       0.10,
			userSharePercent: 70,
			expectedTotal:    0,
			expectedUser:     0,
			expectedDev:      0,
			expectedFee:      0,
		},
		{
			name:             "invalid user share defaults to 70%",
			qualityScore:     1.0,
			activeSeconds:    3600,
			hourlyRate:       0.10,
			userSharePercent: 30, // Below minimum, should default to 70%
			expectedTotal:    0.10,
			expectedUser:     0.07,
			expectedDev:      0.025,
			expectedFee:      0.005,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			calc := CalculatePayout(tt.qualityScore, tt.activeSeconds, tt.hourlyRate, tt.userSharePercent)

			assert.InDelta(t, tt.expectedTotal, calc.TotalAmount, 0.0001)
			assert.InDelta(t, tt.expectedUser, calc.UserAmount, 0.0001)
			assert.InDelta(t, tt.expectedDev, calc.DeveloperAmount, 0.0001)
			assert.InDelta(t, tt.expectedFee, calc.PlatformFee, 0.0001)
		})
	}
}

func TestWallet_ShouldReleasePending(t *testing.T) {
	tests := []struct {
		name           string
		pendingBalance float64
		expected       bool
	}{
		{"above threshold", 0.02, true},
		{"at threshold", 0.01, true},
		{"below threshold", 0.005, false},
		{"zero", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wallet := &Wallet{PendingBalance: tt.pendingBalance}
			assert.Equal(t, tt.expected, wallet.ShouldReleasePending())
		})
	}
}

func TestWallet_ReleasePending(t *testing.T) {
	t.Run("releases when above threshold", func(t *testing.T) {
		wallet := &Wallet{Balance: 1.0, PendingBalance: 0.02}
		released := wallet.ReleasePending()

		assert.Equal(t, 0.02, released)
		assert.Equal(t, 1.02, wallet.Balance)
		assert.Equal(t, 0.0, wallet.PendingBalance)
	})

	t.Run("does not release when below threshold", func(t *testing.T) {
		wallet := &Wallet{Balance: 1.0, PendingBalance: 0.005}
		released := wallet.ReleasePending()

		assert.Equal(t, 0.0, released)
		assert.Equal(t, 1.0, wallet.Balance)
		assert.Equal(t, 0.005, wallet.PendingBalance)
	})
}

func TestRevenueSharesSum(t *testing.T) {
	// Platform fee is fixed at 5%, user share is configurable (50-90%)
	// Developer gets the remainder: 100 - 5 - userShare
	assert.Equal(t, 5, PlatformFeePercent, "Platform fee should be 5%%")
	assert.Equal(t, 70, DefaultUserSharePercent, "Default user share should be 70%%")
	assert.Equal(t, 50, MinUserSharePercent, "Minimum user share should be 50%%")
	assert.Equal(t, 90, MaxUserSharePercent, "Maximum user share should be 90%%")

	// Verify that with default share, total is 100%
	defaultDevShare := 100 - PlatformFeePercent - DefaultUserSharePercent
	assert.Equal(t, 25, defaultDevShare, "Default developer share should be 25%%")
}

func TestDeveloper_SetUserSharePercent(t *testing.T) {
	tests := []struct {
		name        string
		percent     int
		expectError bool
		expectedDev int
	}{
		{"valid 70%", 70, false, 25},
		{"valid 50% (min)", 50, false, 45},
		{"valid 90% (max)", 90, false, 5},
		{"invalid below min", 49, true, 0},
		{"invalid above max", 91, true, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dev := NewDeveloper("test", "test@example.com", "password")
			err := dev.SetUserSharePercent(tt.percent)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.percent, dev.UserSharePercent)
				assert.Equal(t, tt.expectedDev, dev.GetDeveloperSharePercent())
			}
		})
	}
}
