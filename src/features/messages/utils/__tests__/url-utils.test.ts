import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  detectUrls,
  hasHttpUrlCredentials,
  hasUrls,
  isPolityLink,
  parseMessageWithLinks,
  parsePolityUrl,
} from '../url-utils';

describe('message URL helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects credentials only in valid HTTP URLs', () => {
    expect(hasHttpUrlCredentials('https://user:secret@example.test/path')).toBe(true);
    expect(hasHttpUrlCredentials('https://example.test/path')).toBe(false);
    expect(hasHttpUrlCredentials('ftp://user:secret@example.test/path')).toBe(false);
    expect(hasHttpUrlCredentials('http://[')).toBe(false);
  });

  it('detects web and Polity links and handles text without matches', () => {
    expect(detectUrls('Open www.example.test and /group/group-1')).toEqual([
      'www.example.test',
      '/group/group-1',
    ]);
    expect(detectUrls('plain text')).toEqual([]);
    expect(hasUrls('https://example.test')).toBe(true);
    expect(hasUrls('plain text')).toBe(false);
  });

  it('splits surrounding text and normalizes www links', () => {
    expect(parseMessageWithLinks('Before www.example.test after')).toEqual([
      { type: 'text', content: 'Before ' },
      { type: 'url', content: 'https://www.example.test' },
      { type: 'text', content: ' after' },
    ]);
    expect(parseMessageWithLinks('/event/event-1')).toEqual([
      { type: 'url', content: '/event/event-1' },
    ]);
    expect(parseMessageWithLinks('plain')).toEqual([{ type: 'text', content: 'plain' }]);
    expect(parseMessageWithLinks('')).toEqual([{ type: 'text', content: '' }]);
  });

  it('parses every supported relative entity path and normalizes plural todos', () => {
    for (const type of ['user', 'group', 'event', 'amendment', 'blog', 'statement', 'todo']) {
      expect(parsePolityUrl(`/${type}/entity-1`)).toEqual({ type, id: 'entity-1' });
    }
    expect(parsePolityUrl('/todos/todo-1')).toEqual({ type: 'todo', id: 'todo-1' });
    expect(parsePolityUrl('/unknown/entity-1')).toBeNull();
    expect(parsePolityUrl('http://[')).toBeNull();
  });

  it('checks relative links and same-host absolute links in a browser', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://polity.example', hostname: 'polity.example' },
    });

    expect(isPolityLink('/group/group-1')).toBe(true);
    expect(isPolityLink('/todos/todo-1')).toBe(true);
    expect(isPolityLink('https://polity.example/event/event-1')).toBe(true);
    expect(isPolityLink('https://external.example/event/event-1')).toBe(false);
    expect(isPolityLink('http://[')).toBe(false);
  });

  it('uses the server fallback origin when no browser exists', () => {
    vi.stubGlobal('window', undefined);

    expect(parsePolityUrl('/statement/statement-1')).toEqual({
      type: 'statement',
      id: 'statement-1',
    });
    expect(isPolityLink('https://any.example/blog/blog-1')).toBe(true);
  });
});
