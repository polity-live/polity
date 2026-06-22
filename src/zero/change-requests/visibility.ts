import type { EditingMode } from '../amendments/editing-mode-policy';

export type ChangeRequestVisibilityScope = 'collaborators' | 'public';

export const INTERNAL_CR_RESOLUTION_DEFAULT_VISIBILITY = 'public' as const;

export function normalizeInternalChangeRequestResolutionVisibility(
  value: string | null | undefined
): ChangeRequestVisibilityScope {
  return value === 'collaborators' ? 'collaborators' : INTERNAL_CR_RESOLUTION_DEFAULT_VISIBILITY;
}

export function isEventChangeRequestMode(mode: EditingMode) {
  return mode === 'suggest_event' || mode === 'event_final_closing_vote';
}

export function getOpenChangeRequestVisibilityScope(
  createdInMode: EditingMode
): ChangeRequestVisibilityScope {
  return isEventChangeRequestMode(createdInMode) ? 'public' : 'collaborators';
}

export function getResolvedChangeRequestVisibilityScope({
  resolvedInMode,
  internalResolutionVisibility,
}: {
  resolvedInMode: EditingMode;
  internalResolutionVisibility?: string | null;
}): ChangeRequestVisibilityScope {
  if (isEventChangeRequestMode(resolvedInMode)) {
    return 'public';
  }

  return normalizeInternalChangeRequestResolutionVisibility(internalResolutionVisibility);
}
