import { isIP } from 'node:net';

function isBlockedIPv4(hostname: string) {
  const bytes = hostname.split('.').map(Number);
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

function getCanonicalMappedIPv4(hostname: string) {
  const match = /^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/.exec(hostname);
  if (!match) return null;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function isBlockedIPv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  const mappedIPv4 = getCanonicalMappedIPv4(normalized);
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
    (mappedIPv4 !== null && isBlockedIPv4(mappedIPv4))
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
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
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
