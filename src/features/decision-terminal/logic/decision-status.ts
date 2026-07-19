import { featureThemeClassName } from '@/features/shared/theme';
import type { DecisionStatus } from '@/features/shared/ui/status';
import { formatCountdownTime } from './formatTimeUtils';
/**
 * Decision status utilities for the Decision Terminal
 * Calculates status, urgency levels, and formats countdowns
 */

/**
 * Calculate vote/election status based on end time
 */
export function getDecisionStatus(
  endsAt: Date | string,
  result?: 'passed' | 'failed' | 'tied' | 'elected'
): DecisionStatus {
  const end = new Date(endsAt);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();

  // If ended, return the result status
  if (diffMs <= 0) {
    return result || 'passed'; // Default to passed if no result specified
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes <= 15) {
    return 'final_minutes';
  }
  if (diffMinutes <= 60) {
    return 'last_hour';
  }
  if (diffHours <= 24) {
    return 'closing_soon';
  }

  return 'open';
}

/**
 * Check if a decision is urgent (less than 1 hour remaining)
 */
export function isUrgent(endsAt: Date | string): boolean {
  const end = new Date(endsAt);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= 60 * 60 * 1000; // 1 hour
}

/**
 * Check if a decision is closing soon (less than 24 hours remaining)
 */
export function isClosingSoon(endsAt: Date | string): boolean {
  const end = new Date(endsAt);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000; // 24 hours
}

/**
 * Check if a decision has ended
 */
export function isClosed(endsAt: Date | string): boolean {
  const end = new Date(endsAt);
  const now = new Date();
  return end.getTime() <= now.getTime();
}

/**
 * Check if a decision is opening soon (starts within 24 hours and hasn't started yet)
 */
export function isOpeningSoon(startsAt: Date | string): boolean {
  const start = new Date(startsAt);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000; // 24 hours
}

/**
 * Check if a decision was recently closed (within the last 24 hours)
 */
export function isRecentlyClosed(endsAt: Date | string): boolean {
  const end = new Date(endsAt);
  const now = new Date();
  const diffMs = now.getTime() - end.getTime();
  return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000; // 24 hours
}

/**
 * Format countdown as HH:MM:SS or XdHH:MM:SS for long durations
 */
export function formatCountdown(endsAt: Date | string, locale?: 'en' | 'de'): string {
  const end = new Date(endsAt);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) {
    return '00:00:00';
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return formatCountdownTime(hours, minutes, seconds, { locale });
}

/**
 * Get CSS color class for a status
 */
export function getStatusColorClass(status: DecisionStatus): string {
  switch (status) {
    case 'open':
      return featureThemeClassName('decisionterminalDecisionStatusSuccessText');
    case 'closing_soon':
      return featureThemeClassName('decisionterminalDecisionStatusWarningText');
    case 'last_hour':
      return featureThemeClassName('decisionterminalDecisionStatusWarningTextAlpha');
    case 'final_minutes':
      return featureThemeClassName('decisionterminalDecisionStatusDangerText');
    case 'passed':
    case 'elected':
      return featureThemeClassName('decisionterminalDecisionStatusSuccessText');
    case 'failed':
      return featureThemeClassName('decisionterminalDecisionStatusDangerTextAlpha');
    case 'tied':
      return featureThemeClassName('decisionterminalDecisionStatusNeutralText');
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Generate a decision ID prefix based on type
 */
export function generateDecisionId(type: 'vote' | 'election', index: number): string {
  const prefix = type === 'vote' ? 'V' : 'E';
  return `${prefix}-${index.toString().padStart(3, '0')}`;
}
