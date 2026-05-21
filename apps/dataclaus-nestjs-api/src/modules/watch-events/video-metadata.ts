/**
 * Mirror of apps/tiktok-backend/data/videos.json — only the fields the
 * ingest endpoint needs (id, tags, category). Populated in Task 16; empty
 * placeholder here is intentional. Lookups against missing ids default to
 * empty tags + 'other' category.
 */
export const VIDEO_METADATA: Record<string, { tags: string[]; category: string }> = {};
