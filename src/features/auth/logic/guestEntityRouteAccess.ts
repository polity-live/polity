const GUEST_ACCESSIBLE_ENTITY_PREFIXES = ['/user/', '/group/', '/amendment/', '/event/', '/blog/'];

const GUEST_RESTRICTED_ENTITY_SEGMENTS = [
  '/settings',
  '/edit',
  '/editor',
  '/notifications',
  '/notification-settings',
  '/operation',
];

export function isGuestAccessibleEntityPath(pathname: string) {
  if (!GUEST_ACCESSIBLE_ENTITY_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return false;
  }

  return !GUEST_RESTRICTED_ENTITY_SEGMENTS.some(segment => pathname.includes(segment));
}
