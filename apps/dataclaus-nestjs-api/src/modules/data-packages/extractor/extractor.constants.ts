export const PRICE_BASELINE_USD_PER_ROW: Record<string, number> = {
  fitness:       0.0008,
  social:        0.0003,
  finance:       0.0050,
  entertainment: 0.0004,
  health:        0.0012,
  location:      0.0006,
  productivity:  0.0005,
  other:         0.0004,
};

export const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  accelerometer: 'fitness',
  gyroscope:     'fitness',
  scroll:        'social',
  screen_view:   'social',
  touch:         'entertainment',
};

export const EXTRACT_MIN_ROWS = 100;
export const EXTRACT_MIN_UNIQUE_USERS = 5;
export const EXTRACT_DEFAULT_RANGE_DAYS = 30;
export const EXTRACT_SAMPLE_HIGH_QUALITY = 6;   // quality_score >= 0.6
export const EXTRACT_SAMPLE_LOW_QUALITY = 2;    // quality_score <  0.6
