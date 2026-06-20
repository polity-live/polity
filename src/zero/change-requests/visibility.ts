export type ChangeRequestVisibilityScope = 'collaborators' | 'public';

export const INTERNAL_CR_RESOLUTION_DEFAULT_VISIBILITY = 'public' as const;

export function normalizeInternalChangeRequestResolutionVisibility(
  value: string | null | undefined
): ChangeRequestVisibilityScope {
  return value === 'collaborators' ? 'collaborators' : INTERNAL_CR_RESOLUTION_DEFAULT_VISIBILITY;
}

export function isEventChangeRequestMode(mode: string | null | undefined) {
  return mode === 'suggest_event' || mode === 'vote_event';
}

export function getOpenChangeRequestVisibilityScope(
  createdInMode: string | null | undefined
): ChangeRequestVisibilityScope {
  return isEventChangeRequestMode(createdInMode) ? 'public' : 'collaborators';
}

export function getResolvedChangeRequestVisibilityScope({
  resolvedInMode,
  internalResolutionVisibility,
}: {
  resolvedInMode: string | null | undefined;
  internalResolutionVisibility?: string | null;
}): ChangeRequestVisibilityScope {
  if (isEventChangeRequestMode(resolvedInMode)) {
    return 'public';
  }

  return normalizeInternalChangeRequestResolutionVisibility(internalResolutionVisibility);
}
