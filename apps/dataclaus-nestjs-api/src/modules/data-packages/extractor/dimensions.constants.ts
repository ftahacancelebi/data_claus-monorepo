export type DimensionName = 'behavior' | 'demographic' | 'device';

/**
 * Per-app declared dimensions. Looked up by app name (case-sensitive, matches
 * the demo-seed value). Apps not listed here default to ['device'] only.
 */
export const APP_DIMENSIONS: Record<string, DimensionName[]> = {
  'TikTok Clone':       ['behavior', 'demographic', 'device'],
  'Cinema+ Streaming':  ['behavior', 'demographic', 'device'],
  'FitMove Tracker':    ['behavior', 'demographic', 'device'],
};

/**
 * Industry anchor bands for the Gemini valuator prompt. Inclusive bounds.
 * Sources cited in the spec §3.4. Units are USD per 1,000 units.
 */
export const INDUSTRY_ANCHORS: Record<DimensionName, { lowPerThousand: number; highPerThousand: number; unitLabel: string }> = {
  behavior:    { lowPerThousand: 1.0,  highPerThousand: 10.0, unitLabel: 'event'   },
  demographic: { lowPerThousand: 5.0,  highPerThousand: 50.0, unitLabel: 'profile' },
  device:      { lowPerThousand: 0.5,  highPerThousand: 5.0,  unitLabel: 'event'   },
};

/** ±20% beyond the anchor band triggers a clamp + justification annotation. */
export const ANCHOR_CLAMP_TOLERANCE = 0.20;

/** Hardcoded video metadata mirror used by the ingest endpoint. */
export const TAG_TAXONOMY: readonly string[] = [
  'dance', 'comedy', 'gaming', 'beauty', 'food', 'fitness', 'vlog', 'asmr',
  'education', 'music', 'fashion', 'animals', 'travel', 'sports', 'art',
  'diy', 'news', 'lifestyle', 'finance', 'tech',
] as const;
