package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// reCAPTCHA Enterprise configuration
const (
	RecaptchaAPIEndpoint    = "https://recaptchaenterprise.googleapis.com/v1"
	BotScoreThreshold       = 0.5 // Scores below this are considered bots
	DefaultRecaptchaTimeout = 10 * time.Second
)

// reCAPTCHA errors
var (
	ErrRecaptchaNotConfigured = errors.New("reCAPTCHA Enterprise not configured")
	ErrRecaptchaVerifyFailed  = errors.New("reCAPTCHA verification failed")
	ErrRecaptchaBotDetected   = errors.New("bot activity detected")
)

// RecaptchaConfig holds configuration for reCAPTCHA Enterprise
type RecaptchaConfig struct {
	ProjectID  string // GCP project ID
	SiteKey    string // reCAPTCHA site key
	APIKey     string // GCP API key (for REST API)
	Enabled    bool   // Feature flag
}

// RecaptchaService handles reCAPTCHA Enterprise verification
type RecaptchaService struct {
	config     RecaptchaConfig
	httpClient *http.Client
}

// NewRecaptchaService creates a new reCAPTCHA service
func NewRecaptchaService(config RecaptchaConfig) *RecaptchaService {
	return &RecaptchaService{
		config: config,
		httpClient: &http.Client{
			Timeout: DefaultRecaptchaTimeout,
		},
	}
}

// VerifyRequest contains the request to verify a reCAPTCHA token
type VerifyRequest struct {
	Token         string `json:"token"`
	Action        string `json:"action"`
	SiteKey       string `json:"site_key,omitempty"`
	UserIPAddress string `json:"user_ip_address,omitempty"`
	UserAgent     string `json:"user_agent,omitempty"`
}

// VerifyResponse contains the result of reCAPTCHA verification
type VerifyResponse struct {
	Valid           bool      `json:"valid"`
	Score           float64   `json:"score"`
	Action          string    `json:"action"`
	IsBot           bool      `json:"is_bot"`
	Reasons         []string  `json:"reasons,omitempty"`
	TokenProperties *TokenProperties `json:"token_properties,omitempty"`
	RiskAnalysis    *RiskAnalysis    `json:"risk_analysis,omitempty"`
}

// TokenProperties from reCAPTCHA Enterprise response
type TokenProperties struct {
	Valid            bool   `json:"valid"`
	InvalidReason    string `json:"invalidReason,omitempty"`
	Hostname         string `json:"hostname,omitempty"`
	Action           string `json:"action,omitempty"`
	CreateTime       string `json:"createTime,omitempty"`
	AndroidPackageName string `json:"androidPackageName,omitempty"`
	IosBundleId      string `json:"iosBundleId,omitempty"`
}

// RiskAnalysis from reCAPTCHA Enterprise response
type RiskAnalysis struct {
	Score   float64  `json:"score"`
	Reasons []string `json:"reasons,omitempty"`
}

// Verify verifies a reCAPTCHA token using Google's Enterprise API
func (s *RecaptchaService) Verify(ctx context.Context, req VerifyRequest) (*VerifyResponse, error) {
	if !s.config.Enabled {
		// Return a passing result if reCAPTCHA is disabled
		return &VerifyResponse{
			Valid:   true,
			Score:   1.0,
			Action:  req.Action,
			IsBot:   false,
			Reasons: []string{"recaptcha_disabled"},
		}, nil
	}

	if s.config.ProjectID == "" || s.config.APIKey == "" {
		return nil, ErrRecaptchaNotConfigured
	}

	siteKey := req.SiteKey
	if siteKey == "" {
		siteKey = s.config.SiteKey
	}

	// Build the assessment request
	assessment := map[string]interface{}{
		"event": map[string]interface{}{
			"token":         req.Token,
			"siteKey":       siteKey,
			"expectedAction": req.Action,
		},
	}

	// Add optional fields
	if req.UserIPAddress != "" {
		assessment["event"].(map[string]interface{})["userIpAddress"] = req.UserIPAddress
	}
	if req.UserAgent != "" {
		assessment["event"].(map[string]interface{})["userAgent"] = req.UserAgent
	}

	requestBody, err := json.Marshal(assessment)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal assessment: %w", err)
	}

	// Create assessment via REST API
	url := fmt.Sprintf("%s/projects/%s/assessments?key=%s",
		RecaptchaAPIEndpoint, s.config.ProjectID, s.config.APIKey)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(requestBody)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call reCAPTCHA API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("reCAPTCHA API error: %s - %s", resp.Status, string(body))
	}

	// Parse response
	var apiResp struct {
		Name            string           `json:"name"`
		Event           json.RawMessage  `json:"event"`
		RiskAnalysis    *RiskAnalysis    `json:"riskAnalysis"`
		TokenProperties *TokenProperties `json:"tokenProperties"`
	}

	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Build response
	result := &VerifyResponse{
		Action:          req.Action,
		TokenProperties: apiResp.TokenProperties,
		RiskAnalysis:    apiResp.RiskAnalysis,
	}

	// Check token validity
	if apiResp.TokenProperties != nil {
		result.Valid = apiResp.TokenProperties.Valid
		if !result.Valid && apiResp.TokenProperties.InvalidReason != "" {
			result.Reasons = append(result.Reasons, apiResp.TokenProperties.InvalidReason)
		}
	}

	// Check risk score
	if apiResp.RiskAnalysis != nil {
		result.Score = apiResp.RiskAnalysis.Score
		result.IsBot = result.Score < BotScoreThreshold
		result.Reasons = append(result.Reasons, apiResp.RiskAnalysis.Reasons...)
	} else {
		result.Score = 0.5
		result.IsBot = false
	}

	return result, nil
}

// VerifyAndBlock verifies and returns an error if bot is detected
func (s *RecaptchaService) VerifyAndBlock(ctx context.Context, req VerifyRequest) error {
	result, err := s.Verify(ctx, req)
	if err != nil {
		return err
	}

	if !result.Valid {
		return ErrRecaptchaVerifyFailed
	}

	if result.IsBot {
		return ErrRecaptchaBotDetected
	}

	return nil
}

// IsConfigured checks if reCAPTCHA is properly configured
func (s *RecaptchaService) IsConfigured() bool {
	return s.config.Enabled && s.config.ProjectID != "" && s.config.APIKey != ""
}

// GetSiteKey returns the site key for client-side integration
func (s *RecaptchaService) GetSiteKey() string {
	return s.config.SiteKey
}
