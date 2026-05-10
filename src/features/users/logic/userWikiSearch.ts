import { richTextToPlainText } from '@/features/shared/logic/richText';

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

export function toSearchableText(value: unknown): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return richTextToPlainText(value).toLowerCase();
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value).toLowerCase();
  }

  if (isDate(value)) {
    return value.toISOString().toLowerCase();
  }

  if (Array.isArray(value)) {
    return value
      .map(entry => toSearchableText(entry))
      .filter(Boolean)
      .join(' ');
  }

  return richTextToPlainText(value).toLowerCase();
}

export function buildSearchText(...values: unknown[]): string {
  return values
    .map(value => toSearchableText(value))
    .filter(Boolean)
    .join(' ');
}

export function matchesSearchQuery(query: string, ...values: unknown[]): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values.some(value => toSearchableText(value).includes(normalizedQuery));
}
