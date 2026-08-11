import { describe, expect, it } from 'vitest';
import {
  isValidOptionalEventStreamUrl,
  normalizeEventStreamUrl,
  resolveEventStreamSource,
} from '../eventStreamUrl';

describe('eventStreamUrl', () => {
  it('normalizes protocol-less HTTP URLs and rejects unsafe protocols', () => {
    expect(normalizeEventStreamUrl(' youtube.com/watch?v=dQw4w9WgXcQ ')).toBe(
      'https://youtube.com/watch?v=dQw4w9WgXcQ'
    );
    expect(normalizeEventStreamUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeEventStreamUrl('ftp://example.com/live')).toBeNull();
    expect(isValidOptionalEventStreamUrl('')).toBe(true);
  });

  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/live/dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  ])('resolves YouTube URL %s', value => {
    const source = resolveEventStreamSource(value, 'polity.test');
    expect(source?.provider).toBe('youtube');
    expect(source && 'embedUrl' in source ? source.embedUrl : '').toContain('/embed/dQw4w9WgXcQ');
  });

  it.each([
    ['https://twitch.tv/polity_live', 'channel=polity_live'],
    ['https://www.twitch.tv/videos/123456789', 'video=v123456789'],
    ['https://clips.twitch.tv/HelpfulClip', 'clip=HelpfulClip'],
  ])('resolves Twitch URL %s with its required parent', (value, expectedParam) => {
    const source = resolveEventStreamSource(value, 'app.polity.test');
    expect(source?.provider).toBe('twitch');
    const embedUrl = source && 'embedUrl' in source ? source.embedUrl : '';
    expect(embedUrl).toContain(expectedParam);
    expect(embedUrl).toContain('parent=app.polity.test');
  });

  it('uses a safe external fallback for unknown providers', () => {
    expect(resolveEventStreamSource('https://video.example/live', 'polity.test')).toEqual({
      provider: 'external',
      externalUrl: 'https://video.example/live',
    });
  });

  it('covers empty, malformed, explicit HTTP, and optional validation variants', () => {
    expect(normalizeEventStreamUrl(null)).toBeNull();
    expect(normalizeEventStreamUrl('   ')).toBeNull();
    expect(normalizeEventStreamUrl('http://example.com/live')).toBe('http://example.com/live');
    expect(normalizeEventStreamUrl('http://[')).toBeNull();
    expect(normalizeEventStreamUrl('https://')).toBeNull();
    expect(isValidOptionalEventStreamUrl('video.example/live')).toBe(true);
    expect(isValidOptionalEventStreamUrl('javascript:bad')).toBe(false);
    expect(resolveEventStreamSource(undefined, 'parent.test')).toBeNull();
  });

  it.each([
    'https://youtu.be/',
    'https://youtu.be/short',
    'https://youtube.com/watch',
    'https://youtube.com/live/',
    'https://youtube.com/other/dQw4w9WgXcQ',
    'https://youtube-nocookie.com/embed/dQw4w9WgXcQ',
  ])('handles sparse YouTube-shaped URL %s', value => {
    const source = resolveEventStreamSource(value, 'parent.test');
    if (value.includes('youtube-nocookie')) expect(source?.provider).toBe('youtube');
    else expect(source?.provider).toBe('external');
  });

  it.each([
    ['https://m.twitch.tv/channel/clip/HelpfulClip', 'clip=HelpfulClip'],
    ['https://twitch.tv/clip/HelpfulClip', 'clip=HelpfulClip'],
    ['https://twitch.tv/videos/not-a-number', null],
    ['https://twitch.tv/videos', null],
    ['https://twitch.tv/directory', null],
    ['https://twitch.tv/channel/clip/', 'channel=channel'],
    ['https://clips.twitch.tv/', null],
  ])('covers Twitch path variant %s', (value, expected) => {
    const source = resolveEventStreamSource(value, 'parent.test');
    if (expected) {
      expect(source && 'embedUrl' in source ? source.embedUrl : '').toContain(expected);
    } else {
      expect(source?.provider).toBe('external');
    }
  });

  it('requires a Twitch parent and rejects unrelated Twitch-like hosts', () => {
    expect(resolveEventStreamSource('https://twitch.tv/channel', '')?.provider).toBe('external');
    expect(resolveEventStreamSource('https://example.com/channel', 'parent.test')?.provider).toBe(
      'external'
    );
  });
});
