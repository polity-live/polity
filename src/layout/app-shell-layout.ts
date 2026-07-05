export type AppShellPageFrame = 'bare' | 'contained' | 'fullWidth' | 'uncontained';

const ENTITY_ROUTE_PATTERN = /^\/(?:group|user|event|amendment|blog)\/[^/]+(?:\/.*)?$/;

const SELF_FRAMED_ENTITY_PAGE_PATTERNS = [
  /^\/group\/[^/]+\/?$/,
  /^\/user\/[^/]+\/?$/,
  /^\/event\/[^/]+\/?$/,
  /^\/amendment\/[^/]+\/?$/,
  /^\/blog\/[^/]+\/?$/,
  /^\/group\/[^/]+\/blog\/[^/]+\/?$/,
  /^\/user\/[^/]+\/blog\/[^/]+\/?$/,
];

const UNCONTAINED_ENTITY_ROUTE_PATTERNS = [
  /^\/group\/[^/]+\/network$/,
  /^\/user\/[^/]+\/network$/,
  /^\/event\/[^/]+\/network$/,
  /^\/amendment\/[^/]+\/process$/,
];

export const APP_SHELL_PAGE_FRAME_CLASS: Record<Exclude<AppShellPageFrame, 'bare'>, string> = {
  contained: 'mx-auto max-w-7xl px-4 py-6',
  fullWidth: 'mx-auto px-4 py-6',
  uncontained: 'p-2',
};

export function isLandingPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/features' ||
    pathname === '/solutions' ||
    pathname === '/imprint'
  );
}

export function getAuthenticatedPageFrame(pathname: string): AppShellPageFrame {
  if (isSelfFramedEntityPage(pathname)) {
    return 'bare';
  }

  if (isUncontainedEntityRoute(pathname)) {
    return 'uncontained';
  }

  if (pathname === '/home' || pathname === '/search') {
    return 'fullWidth';
  }

  return 'contained';
}

export function getUnauthenticatedPageFrame(pathname: string): AppShellPageFrame {
  if (isSelfFramedEntityPage(pathname)) {
    return 'bare';
  }

  if (isUncontainedEntityRoute(pathname)) {
    return 'uncontained';
  }

  if (ENTITY_ROUTE_PATTERN.test(pathname)) {
    return 'contained';
  }

  return 'bare';
}

function isUncontainedEntityRoute(pathname: string): boolean {
  return UNCONTAINED_ENTITY_ROUTE_PATTERNS.some(pattern => pattern.test(pathname));
}

function isSelfFramedEntityPage(pathname: string): boolean {
  return SELF_FRAMED_ENTITY_PAGE_PATTERNS.some(pattern => pattern.test(pathname));
}
