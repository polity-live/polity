import { richTextToPlainText } from '@/features/shared/logic/richText';

const TEXT_LIKE_CARD_PROP_KEYS = new Set([
  'description',
  'excerpt',
  'content',
  'bio',
  'question',
  'caption',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeTextLikeValue(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const text = richTextToPlainText(value);
  return text.length > 0 ? text : null;
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (key && TEXT_LIKE_CARD_PROP_KEYS.has(key)) {
    return sanitizeTextLikeValue(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey),
    ])
  );
}

export function sanitizeAttachmentCardProps(
  value: Record<string, unknown>
): Record<string, unknown> {
  return sanitizeValue(value) as Record<string, unknown>;
}
