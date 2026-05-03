export type RouteVisibility = 'public' | 'authenticated' | 'private';
export type RouteVisibilityInput = string | null | undefined;
export type UnauthorizedReason = 'login-required' | 'private';

export interface RouteVisibilityDecision {
  allowed: boolean;
  reason?: UnauthorizedReason;
  visibility: RouteVisibility;
}

export function normalizeRouteVisibility(visibility: RouteVisibilityInput): RouteVisibility {
  if (visibility == null) {
    return 'public';
  }

  if (visibility === 'public' || visibility === 'authenticated' || visibility === 'private') {
    return visibility;
  }

  return 'private';
}

export function getEffectiveRouteVisibility(visibilities: RouteVisibilityInput[]): RouteVisibility {
  return visibilities.reduce<RouteVisibility>((effectiveVisibility, visibility) => {
    const normalizedVisibility = normalizeRouteVisibility(visibility);

    if (normalizedVisibility === 'private' || effectiveVisibility === 'private') {
      return 'private';
    }

    if (normalizedVisibility === 'authenticated' || effectiveVisibility === 'authenticated') {
      return 'authenticated';
    }

    return 'public';
  }, 'public');
}

export function resolveRouteVisibilityAccess(
  visibilities: RouteVisibilityInput[],
  isAuthenticated: boolean
): RouteVisibilityDecision {
  const visibility = getEffectiveRouteVisibility(visibilities);

  if (visibility === 'public') {
    return { allowed: true, visibility };
  }

  if (visibility === 'authenticated') {
    return {
      allowed: isAuthenticated,
      reason: isAuthenticated ? undefined : 'login-required',
      visibility,
    };
  }

  return {
    allowed: false,
    reason: 'private',
    visibility,
  };
}
