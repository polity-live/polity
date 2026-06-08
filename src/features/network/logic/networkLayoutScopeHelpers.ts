import type { GroupNetworkLayout, GroupNetworkLayouts } from '@/zero/preferences';

export function getPersistedNetworkLayout(
  layouts: GroupNetworkLayouts,
  scopeKey: string,
  legacyScopeKeys: readonly string[] = []
): GroupNetworkLayout | null {
  const scopedLayout = layouts[scopeKey];
  if (scopedLayout) {
    return scopedLayout;
  }

  for (const legacyScopeKey of legacyScopeKeys) {
    const legacyLayout = layouts[legacyScopeKey];
    if (legacyLayout) {
      return legacyLayout;
    }
  }

  return null;
}

export function savePersistedNetworkLayouts(args: {
  layouts: GroupNetworkLayouts;
  scopeKey: string;
  layout: GroupNetworkLayout;
  legacyScopeKeys?: readonly string[];
}): GroupNetworkLayouts {
  const { layouts, scopeKey, layout, legacyScopeKeys = [] } = args;
  return {
    ...Object.fromEntries(
      Object.entries(layouts).filter(
        ([currentScopeKey]) => !legacyScopeKeys.includes(currentScopeKey)
      )
    ),
    [scopeKey]: layout,
  };
}

export function resetPersistedNetworkLayouts(args: {
  layouts: GroupNetworkLayouts;
  scopeKey: string;
  legacyScopeKeys?: readonly string[];
}): GroupNetworkLayouts {
  const { layouts, scopeKey, legacyScopeKeys = [] } = args;
  return Object.fromEntries(
    Object.entries(layouts).filter(
      ([currentScopeKey]) =>
        currentScopeKey !== scopeKey && !legacyScopeKeys.includes(currentScopeKey)
    )
  );
}
