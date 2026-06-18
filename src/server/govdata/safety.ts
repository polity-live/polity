import { isIP } from 'node:net';

function parseIPv4(hostname: string) {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const bytes = parts.map(part => Number(part));
  return bytes.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255) ? bytes : null;
}

function isBlockedIPv4(hostname: string) {
  const bytes = parseIPv4(hostname);
  if (!bytes) return false;
  const [first, second] = bytes;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19 || (second === 51 && bytes[2] === 100))) ||
    (first === 203 && second === 0 && bytes[2] === 113) ||
    (first === 100 && second >= 64 && second <= 127) ||
    first >= 224
  );
}

function isBlockedIPv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
}

export function assertSafePublicHttpUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid resource URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only HTTP(S) GovData resources can be imported');
  }

  const hostname = url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('GovData resource URL is not public');
  }
  if (!hostname.includes('.') && isIP(hostname) === 0) {
    throw new Error('GovData resource URL is not public');
  }
  if (isIP(hostname) === 4 && isBlockedIPv4(hostname)) {
    throw new Error('GovData resource URL is not public');
  }
  if (isIP(hostname) === 6 && isBlockedIPv6(hostname)) {
    throw new Error('GovData resource URL is not public');
  }

  return url;
}
