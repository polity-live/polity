export type ContactLinkKey =
  | 'website'
  | 'youtube'
  | 'linkedin'
  | 'whatsapp'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'snapchat'
  | 'tiktok';

const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const PROTOCOL_RELATIVE_PATTERN = /^\/\//;

function normalizeValue(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function ensureExternalUrl(value: string): string {
  if (URL_SCHEME_PATTERN.test(value)) {
    return value;
  }

  if (PROTOCOL_RELATIVE_PATTERN.test(value)) {
    return `https:${value}`;
  }

  return `https://${value.replace(/^\/+/, '')}`;
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, '').replace(/^\/+/, '').replace(/\/+$/, '');
}

function normalizePath(value: string): string {
  return value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

export function buildContactLinkHref(key: ContactLinkKey, value?: string | null): string | null {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue) {
    return null;
  }

  switch (key) {
    case 'website':
      return ensureExternalUrl(normalizedValue);
    case 'youtube': {
      if (URL_SCHEME_PATTERN.test(normalizedValue)) {
        return normalizedValue;
      }

      const path = normalizePath(normalizedValue);
      if (path.startsWith('@') || path.includes('/')) {
        return `https://www.youtube.com/${path}`;
      }

      return `https://www.youtube.com/@${normalizeHandle(path)}`;
    }
    case 'linkedin': {
      if (URL_SCHEME_PATTERN.test(normalizedValue)) {
        return normalizedValue;
      }

      const path = normalizePath(normalizedValue);
      if (path.includes('/')) {
        return `https://www.linkedin.com/${path}`;
      }

      return `https://www.linkedin.com/in/${normalizeHandle(path)}`;
    }
    case 'whatsapp': {
      if (
        URL_SCHEME_PATTERN.test(normalizedValue) ||
        PROTOCOL_RELATIVE_PATTERN.test(normalizedValue)
      ) {
        return ensureExternalUrl(normalizedValue);
      }

      const digits = normalizedValue.replace(/\D/g, '');
      return digits ? `https://wa.me/${digits}` : ensureExternalUrl(normalizedValue);
    }
    case 'instagram':
      return URL_SCHEME_PATTERN.test(normalizedValue)
        ? normalizedValue
        : `https://instagram.com/${normalizeHandle(normalizedValue)}`;
    case 'twitter':
      return URL_SCHEME_PATTERN.test(normalizedValue)
        ? normalizedValue
        : `https://x.com/${normalizeHandle(normalizedValue)}`;
    case 'facebook':
      return URL_SCHEME_PATTERN.test(normalizedValue)
        ? normalizedValue
        : `https://facebook.com/${normalizeHandle(normalizedValue)}`;
    case 'snapchat':
      return URL_SCHEME_PATTERN.test(normalizedValue)
        ? normalizedValue
        : `https://snapchat.com/add/${normalizeHandle(normalizedValue)}`;
    case 'tiktok': {
      if (URL_SCHEME_PATTERN.test(normalizedValue)) {
        return normalizedValue;
      }

      const handle = normalizeHandle(normalizedValue);
      return `https://www.tiktok.com/@${handle}`;
    }
    default:
      return null;
  }
}
