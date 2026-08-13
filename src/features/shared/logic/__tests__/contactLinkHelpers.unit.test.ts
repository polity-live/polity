import { describe, expect, it } from 'vitest';

import { buildContactLinkHref, type ContactLinkKey } from '../contactLinkHelpers';

describe('buildContactLinkHref', () => {
  it.each([undefined, null, '', '   '])('returns null for empty value %j', value => {
    expect(buildContactLinkHref('website', value)).toBeNull();
  });

  it.each([
    ['https://example.org/path', 'https://example.org/path'],
    ['http://example.org/path', 'http://example.org/path'],
    ['//example.org/path', 'https://example.org/path'],
    ['example.org/path', 'https://example.org/path'],
    ['/example.org/path', 'https://example.org/path'],
  ])('normalizes website %j to %j', (value, expected) => {
    expect(buildContactLinkHref('website', value)).toBe(expected);
  });

  it.each([
    ['https://youtube.com/@polity', 'https://youtube.com/@polity'],
    ['/@polity/', 'https://www.youtube.com/@polity'],
    ['/channel/polity/', 'https://www.youtube.com/channel/polity'],
    ['polity', 'https://www.youtube.com/@polity'],
  ])('normalizes YouTube value %j', (value, expected) => {
    expect(buildContactLinkHref('youtube', value)).toBe(expected);
  });

  it.each([
    ['https://linkedin.com/company/polity', 'https://linkedin.com/company/polity'],
    ['/company/polity/', 'https://www.linkedin.com/company/polity'],
    ['@polity', 'https://www.linkedin.com/in/polity'],
  ])('normalizes LinkedIn value %j', (value, expected) => {
    expect(buildContactLinkHref('linkedin', value)).toBe(expected);
  });

  it.each([
    ['https://wa.me/49123456', 'https://wa.me/49123456'],
    ['//wa.me/49123456', 'https://wa.me/49123456'],
    ['+49 (123) 456', 'https://wa.me/49123456'],
    ['contact', 'https://contact'],
  ])('normalizes WhatsApp value %j', (value, expected) => {
    expect(buildContactLinkHref('whatsapp', value)).toBe(expected);
  });

  it.each([
    ['instagram', '@polity/', 'https://instagram.com/polity'],
    ['twitter', '/@polity/', 'https://x.com/polity'],
    ['facebook', '@polity', 'https://facebook.com/polity'],
    ['snapchat', '@polity', 'https://snapchat.com/add/polity'],
    ['tiktok', '/@polity/', 'https://www.tiktok.com/@polity'],
  ] as const)('normalizes %s handle %j', (key, value, expected) => {
    expect(buildContactLinkHref(key, value)).toBe(expected);
  });

  it.each(['instagram', 'twitter', 'facebook', 'snapchat', 'tiktok'] as const)(
    'preserves a direct HTTPS URL for %s',
    key => {
      expect(buildContactLinkHref(key, 'https://social.example.org/polity')).toBe(
        'https://social.example.org/polity'
      );
    }
  );

  it('never emits an executable JavaScript scheme', () => {
    for (const key of [
      'website',
      'youtube',
      'linkedin',
      'whatsapp',
      'instagram',
      'twitter',
      'facebook',
      'snapchat',
      'tiktok',
    ] satisfies ContactLinkKey[]) {
      expect(buildContactLinkHref(key, 'javascript:alert(1)')).not.toMatch(/^javascript:/i);
    }
  });

  it('returns null for an unsupported runtime key', () => {
    expect(buildContactLinkHref('unsupported' as ContactLinkKey, 'value')).toBeNull();
  });
});
