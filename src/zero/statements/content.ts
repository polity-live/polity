export const STATEMENT_STORY_DURATION_MS = 24 * 60 * 60 * 1000;

export type StatementMediaType = 'text' | 'image' | 'video';

interface StatementContentLike {
  image_url?: string | null;
  text?: string | null;
  title?: string | null;
  video_url?: string | null;
}

interface StatementExpiryLike {
  expires_at?: number | null;
  is_story?: boolean | null;
  user_id?: string | null;
}

export function cleanStatementString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

export function deriveStatementMediaType(
  imageUrl?: string | null,
  videoUrl?: string | null
): StatementMediaType {
  if (videoUrl) return 'video';
  if (imageUrl) return 'image';
  return 'text';
}

export function hasStatementContent(statement: StatementContentLike) {
  return Boolean(
    cleanStatementString(statement.title) ||
    cleanStatementString(statement.text) ||
    cleanStatementString(statement.image_url) ||
    cleanStatementString(statement.video_url)
  );
}

export function getStatementHeadline(
  statement: StatementContentLike,
  fallback = translate('features.statements.fallbacks.statement')
) {
  const explicitTitle = cleanStatementString(statement.title);
  if (explicitTitle) return explicitTitle;

  const firstTextLine = cleanStatementString(statement.text)?.split(/\r?\n/)[0]?.trim();
  if (firstTextLine) {
    return firstTextLine.length > 72 ? `${firstTextLine.slice(0, 69).trim()}...` : firstTextLine;
  }

  if (statement.video_url) return translate('features.statements.fallbacks.video');
  if (statement.image_url) return translate('features.statements.fallbacks.photo');
  return fallback;
}

export function isStatementExpired(
  statement: StatementExpiryLike | null | undefined,
  now = Date.now()
) {
  if (!statement?.is_story || !statement.expires_at) return false;
  return statement.expires_at <= now;
}

export function canViewExpiredStatement(
  statement: StatementExpiryLike | null | undefined,
  userId?: string | null,
  now = Date.now()
) {
  if (!isStatementExpired(statement, now)) return true;
  return Boolean(userId && statement?.user_id === userId);
}
import { translate } from '@/features/shared/hooks/use-translation';
