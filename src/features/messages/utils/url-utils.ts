// URL detection and parsing utilities

export type PolityLinkEntityType =
  | 'user'
  | 'group'
  | 'event'
  | 'amendment'
  | 'blog'
  | 'statement'
  | 'todo';

export interface PolityLink {
  type: PolityLinkEntityType;
  id: string;
}

const POLITY_LINK_ENTITY_TYPES = new Set<string>([
  'user',
  'group',
  'event',
  'amendment',
  'blog',
  'statement',
  'todo',
  'todos',
]);

function isPolityLinkEntityType(value: string): value is PolityLinkEntityType | 'todos' {
  return POLITY_LINK_ENTITY_TYPES.has(value);
}

function getBaseOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'https://polity.local';
}

function getCurrentHostname(): string | null {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }

  return null;
}

export function detectUrls(text: string): string[] {
  const urlRegex =
    /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\/?(?:user|group|event|amendment|blog|statement|todos?)\/[a-zA-Z0-9_-]+)/gi;
  const matches = text.match(urlRegex);
  return matches || [];
}

export function parseMessageWithLinks(text: string): { type: 'text' | 'url'; content: string }[] {
  const urlRegex =
    /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\/?(?:user|group|event|amendment|blog|statement|todos?)\/[a-zA-Z0-9_-]+)/gi;
  const parts: { type: 'text' | 'url'; content: string }[] = [];

  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before URL
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }

    // Add URL
    let url = match[0];
    // Normalize www URLs
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    // Relative URLs are kept as-is

    parts.push({
      type: 'url',
      content: url,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

export function hasUrls(text: string): boolean {
  return detectUrls(text).length > 0;
}

export function parsePolityUrl(url: string): PolityLink | null {
  try {
    const urlObj = new URL(url, getBaseOrigin());
    const pathname = urlObj.pathname;
    const match = pathname.match(/^\/(user|group|event|amendment|blog|statement|todos?)\/([^/]+)/);

    if (!match) {
      return null;
    }

    const rawType = match[1];
    if (!isPolityLinkEntityType(rawType)) {
      return null;
    }

    const type: PolityLinkEntityType = rawType === 'todos' ? 'todo' : rawType;
    return { type, id: match[2] };
  } catch {
    return null;
  }
}

export function isPolityLink(url: string): boolean {
  try {
    if (
      url.startsWith('/user/') ||
      url.startsWith('/group/') ||
      url.startsWith('/event/') ||
      url.startsWith('/amendment/') ||
      url.startsWith('/blog/') ||
      url.startsWith('/statement/') ||
      url.startsWith('/todo/') ||
      url.startsWith('/todos/')
    ) {
      return parsePolityUrl(url) !== null;
    }

    const urlObj = new URL(url, getBaseOrigin());
    const currentHostname = getCurrentHostname();

    if (currentHostname && urlObj.hostname !== currentHostname) {
      return false;
    }

    return parsePolityUrl(url) !== null;
  } catch {
    return false;
  }
}
