/**
 * Time formatting utilities for Decision Terminal
 * Supports locale-specific formatting with intelligent unit selection
 */

export interface TimeFormatOptions {
  locale?: 'en' | 'de';
  showSeconds?: boolean;
}

/**
 * Get locale-specific time unit labels
 */
function getTimeLabels(locale?: 'en' | 'de') {
  const labels = {
    en: { days: 'd', hours: 'h', minutes: 'm', seconds: 's' },
    de: { days: 'T', hours: 'Std', minutes: 'min', seconds: 's' },
  };
  return labels[locale || 'en'];
}

/**
 * Format time elapsed since an event (e.g., "2T", "3Std", "45min")
 * Intelligently selects the most appropriate unit:
 * - < 1 hour: show minutes
 * - < 24 hours: show hours
 * - >= 24 hours: show days
 */
export function formatTimeElapsed(
  endedAt: Date | string,
  options?: TimeFormatOptions
): string | null {
  const end = new Date(endedAt);
  const now = new Date();
  const diffMs = now.getTime() - end.getTime();

  if (diffMs < 0) {
    return null;
  }

  const labels = getTimeLabels(options?.locale);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Show days if >= 24 hours
  if (diffDays > 0) {
    return `${diffDays}${labels.days}`;
  }

  // Show hours if >= 1 hour
  if (diffHours > 0) {
    return `${diffHours}${labels.hours}`;
  }

  // Show minutes for anything less than 1 hour
  return `${diffMins}${labels.minutes}`;
}

/**
 * Format countdown time with intelligent unit selection
 * - < 1 hour: show MM:SS format with minutes
 * - 1-24 hours: show HH:MM:SS format
 * - >= 24 hours: show XdHH:MM:SS format
 */
export function formatCountdownTime(
  hours: number,
  minutes: number,
  seconds: number,
  options?: TimeFormatOptions
): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const labels = getTimeLabels(options?.locale);

  // For less than 1 hour, show as MM:SS with minutes label
  if (hours === 0) {
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  // For 1-24 hours, show as HH:MM:SS
  if (hours < 24) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  // For >= 24 hours, show as XdHH:MM:SS
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}${labels.days} ${pad(remainingHours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format a duration string showing the most appropriate unit
 * Used for "time remaining" labels
 * Examples: "2T", "12Std", "45min"
 */
export function formatDurationShort(totalSeconds: number, options?: TimeFormatOptions): string {
  if (totalSeconds <= 0) return '0s';

  const labels = getTimeLabels(options?.locale);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // If less than 1 minute, show seconds
  if (hours === 0 && minutes === 0) {
    return `${seconds}${labels.seconds}`;
  }

  // If less than 1 hour, show minutes
  if (hours === 0) {
    return `${minutes}${labels.minutes}`;
  }

  // If less than 24 hours, show hours
  if (hours < 24) {
    return `${hours}${labels.hours}`;
  }

  // For 24+ hours, show days
  const days = Math.floor(hours / 24);
  return `${days}${labels.days}`;
}
