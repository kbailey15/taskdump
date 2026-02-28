/**
 * Normalize a title for duplicate detection:
 * lowercase, strip punctuation, collapse whitespace.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean a title for display:
 * capitalize first letter, strip trailing punctuation, normalize spacing.
 */
export function cleanTitle(title: string): string {
  const cleaned = title
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/, "");

  if (!cleaned) return cleaned;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
