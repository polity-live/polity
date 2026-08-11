import { describe, expect, it } from 'vitest';

import { assertSafePublicHttpUrl } from '../safety';

describe('assertSafePublicHttpUrl', () => {
  it.each(['not a url', 'http://', 'https://[invalid]'])('rejects malformed URL %s', rawUrl => {
    expect(() => assertSafePublicHttpUrl(rawUrl)).toThrow('Invalid resource URL');
  });

  it.each(['ftp://data.example.org/file.csv', 'file:///tmp/file.csv', 'mailto:data@example.org'])(
    'rejects non-HTTP protocol %s',
    rawUrl => {
      expect(() => assertSafePublicHttpUrl(rawUrl)).toThrow(
        'Only HTTP(S) GovData resources can be imported'
      );
    }
  );

  it.each([
    'http://localhost/file.csv',
    'https://LOCALHOST./file.csv',
    'https://data.localhost/file.csv',
    'https://intranet/file.csv',
  ])('rejects local hostname %s', rawUrl => {
    expect(() => assertSafePublicHttpUrl(rawUrl)).toThrow('GovData resource URL is not public');
  });

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '127.255.255.255',
    '169.254.1.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.19.255.255',
    '198.51.100.1',
    '203.0.113.1',
    '100.64.0.1',
    '100.127.255.255',
    '224.0.0.1',
    '255.255.255.255',
  ])('rejects reserved IPv4 address %s', hostname => {
    expect(() => assertSafePublicHttpUrl(`https://${hostname}/file.csv`)).toThrow(
      'GovData resource URL is not public'
    );
  });

  it.each([
    '172.15.255.255',
    '172.32.0.1',
    '198.17.255.255',
    '198.20.0.1',
    '198.51.99.255',
    '198.51.101.0',
    '203.0.112.255',
    '203.0.114.0',
    '100.63.255.255',
    '100.128.0.1',
    '8.8.8.8',
  ])('accepts non-reserved IPv4 address %s', hostname => {
    expect(assertSafePublicHttpUrl(`http://${hostname}/file.csv`).hostname).toBe(hostname);
  });

  it.each([
    '::',
    '::1',
    'fc00::1',
    'fd00::1',
    'fe80::1',
    'fe90::1',
    'fea0::1',
    'feb0::1',
    'ff02::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:192.168.1.1',
  ])('rejects reserved IPv6 address %s', hostname => {
    expect(() => assertSafePublicHttpUrl(`https://[${hostname}]/file.csv`)).toThrow(
      'GovData resource URL is not public'
    );
  });

  it.each(['2001:4860:4860::8888', '::ffff:8.8.8.8'])(
    'accepts public IPv6 address %s',
    hostname => {
      expect(assertSafePublicHttpUrl(`https://[${hostname}]/file.csv`).protocol).toBe('https:');
    }
  );

  it('normalizes case and a trailing DNS dot while preserving a safe URL', () => {
    const result = assertSafePublicHttpUrl('HTTPS://DATA.EXAMPLE.ORG./file.csv');
    expect(result.protocol).toBe('https:');
    expect(result.hostname).toBe('data.example.org.');
  });
});
