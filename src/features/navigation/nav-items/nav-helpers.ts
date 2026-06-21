import type { NavigationItem } from '../types/navigation.types.tsx';

interface RouteParts {
  path: string;
  hash: string;
}

function getRouteParts(route?: string): RouteParts {
  if (!route) {
    return { path: '', hash: '' };
  }

  const [routeWithoutHash, hash = ''] = route.split('#');
  const [path = ''] = routeWithoutHash.split('?');

  return {
    path: path || '/',
    hash: hash ? `#${hash}` : '',
  };
}

function getPathOnly(href?: string): string | undefined {
  return href ? getRouteParts(href).path : undefined;
}

function checkExactPathMatch(item: NavigationItem, currentRoute: string): boolean {
  if (!item.href) return false;

  const itemRoute = getRouteParts(item.href);
  const currentRouteParts = getRouteParts(currentRoute);

  if (itemRoute.hash) {
    return itemRoute.path === currentRouteParts.path && itemRoute.hash === currentRouteParts.hash;
  }

  return itemRoute.path === currentRouteParts.path;
}

function checkHierarchicalPathMatch(
  item: NavigationItem,
  currentRoute: string,
  isPrimary?: boolean
): boolean {
  const itemPath = getPathOnly(item.href);
  const currentPath = getRouteParts(currentRoute).path;
  if (!isPrimary || !itemPath) return false;
  return currentPath.startsWith(itemPath + '/');
}

function checkOnClickRouteMatch(
  item: NavigationItem,
  currentRoute: string,
  isPrimary?: boolean
): boolean {
  if (!item.onClick) return false;

  try {
    const onClickStr = item.onClick.toString();
    // Look for navigation patterns like "navigate({ to: '/route' })" or "router.navigate({ to: '/route' })"
    const routeMatch = onClickStr.match(/to:\s*['"]([^'"]+)['"]\s*}/);

    if (routeMatch) {
      const route = routeMatch[1];
      const currentPath = getRouteParts(currentRoute).path;
      // Exact match
      if (route === currentPath) {
        return true;
      }
      // Child route match - only apply when isPrimary is true
      if (isPrimary && currentPath.startsWith(route + '/')) {
        return true;
      }
    }
  } catch (e) {
    console.error('Error parsing onClick route:', e);
  }

  return false;
}

// Check for ID-based route matches
function checkIdBasedMatch(
  item: NavigationItem,
  currentRoute: string,
  isPrimary?: boolean
): boolean {
  // Special case for home route
  const currentPath = getRouteParts(currentRoute).path;

  if (item.id === 'home' && currentPath === '/') {
    return true;
  }

  const routePath = currentPath.startsWith('/') ? currentPath.slice(1) : currentPath;

  // Exact match with ID
  if (routePath === item.id) {
    return true;
  }

  // Child route matching with ID - only apply when isPrimary is true
  if (isPrimary && routePath.startsWith(item.id + '/')) {
    return true;
  }

  return false;
}

export function isItemActive(
  item: NavigationItem,
  currentRoute?: string,
  isPrimary?: boolean
): boolean {
  if (!currentRoute) return false;

  return (
    checkExactPathMatch(item, currentRoute) ||
    checkHierarchicalPathMatch(item, currentRoute, isPrimary) ||
    checkOnClickRouteMatch(item, currentRoute, isPrimary) ||
    checkIdBasedMatch(item, currentRoute, isPrimary)
  );
}
