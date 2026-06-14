import type { GroupNetworkLayout, GroupNetworkLayouts } from '@/zero/preferences';

export function getPersistedNetworkLayout(
  layouts: GroupNetworkLayouts,
  scopeKey: string
): GroupNetworkLayout | null {
  const scopedLayout = layouts[scopeKey];
  if (scopedLayout) {
    return scopedLayout;
  }

  return null;
}

export function savePersistedNetworkLayouts(args: {
  layouts: GroupNetworkLayouts;
  scopeKey: string;
  layout: GroupNetworkLayout;
}): GroupNetworkLayouts {
  const { layouts, scopeKey, layout } = args;
  return {
    ...layouts,
    [scopeKey]: layout,
  };
}

export function resetPersistedNetworkLayouts(args: {
  layouts: GroupNetworkLayouts;
  scopeKey: string;
}): GroupNetworkLayouts {
  const { layouts, scopeKey } = args;
  return Object.fromEntries(
    Object.entries(layouts).filter(([currentScopeKey]) => currentScopeKey !== scopeKey)
  );
}
