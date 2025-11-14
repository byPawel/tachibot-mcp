/**
 * Timestamp Formatter - Human-readable timestamps for workflow/session output
 * Format: YYYY-MM-DD-DayName-HH-MM-shortid
 * Example: 2025-11-23-Sunday-22-44-a1b2c3d4
 */

import { randomUUID } from 'crypto';

/**
 * Day names for human readability
 */
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

/**
 * Format a date as human-readable timestamp
 * @param date - Date to format (defaults to now)
 * @param includeShortId - Whether to include short UUID (default: true)
 * @returns Formatted timestamp string
 *
 * @example
 * formatTimestamp() // "2025-11-23-Sunday-22-44-a1b2c3d4"
 * formatTimestamp(new Date(), false) // "2025-11-23-Sunday-22-44"
 */
export function formatTimestamp(date: Date = new Date(), includeShortId: boolean = true): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dayName = DAY_NAMES[date.getDay()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  const parts = [year, month, day, dayName, hours, minutes];

  if (includeShortId) {
    const shortId = randomUUID().split('-')[0];
    parts.push(shortId);
  }

  return parts.join('-');
}

/**
 * Parse a human-readable timestamp back to Date
 * @param timestamp - Formatted timestamp string
 * @returns Date object or null if invalid
 *
 * @example
 * parseTimestamp("2025-11-23-Sunday-22-44-a1b2c3d4") // Date object
 */
export function parseTimestamp(timestamp: string): Date | null {
  try {
    // Format: YYYY-MM-DD-DayName-HH-MM-shortid
    const parts = timestamp.split('-');

    if (parts.length < 6) {
      return null;
    }

    const [year, month, day, _dayName, hours, minutes] = parts;

    const date = new Date(
      parseInt(year),
      parseInt(month) - 1, // JS months are 0-indexed
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      0,
      0
    );

    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  } catch {
    return null;
  }
}

/**
 * Generate a workflow ID with human-readable timestamp
 * @param workflowName - Optional workflow name to include
 * @returns Workflow ID string
 *
 * @example
 * generateWorkflowId() // "2025-11-23-Sunday-22-44-a1b2c3d4"
 * generateWorkflowId("pingpong") // "2025-11-23-Sunday-22-44-a1b2c3d4"
 */
export function generateWorkflowId(workflowName?: string): string {
  // Don't include workflow name in the folder name - it's already in the parent path
  // workflow-output/{workflowName}/{timestamp}/
  return formatTimestamp();
}

/**
 * Generate a session ID with human-readable timestamp
 * @param mode - Session mode (e.g., "advanced-pingpong", "workflow-test")
 * @returns Session ID string
 *
 * @example
 * generateSessionId("advanced-pingpong") // "session-2025-11-23-Sunday-22-44-advanced-pingpong"
 */
export function generateSessionId(mode: string): string {
  const timestamp = formatTimestamp(new Date(), false); // No short ID in session names
  return `session-${timestamp}-${mode}`;
}

/**
 * Check if a timestamp is from today
 */
export function isToday(timestamp: string): boolean {
  const parsed = parseTimestamp(timestamp);
  if (!parsed) return false;

  const today = new Date();
  return (
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate()
  );
}

/**
 * Get a human-readable relative time string
 * @example "2 hours ago", "just now", "yesterday"
 */
export function getRelativeTime(timestamp: string): string {
  const parsed = parseTimestamp(timestamp);
  if (!parsed) return 'unknown';

  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return parsed.toLocaleDateString();
}
