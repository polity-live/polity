import { useCallback, useMemo } from 'react';
import {
  usePreferenceActions,
  usePreferenceState,
  type GroupNetworkLayout,
} from '@/zero/preferences';
import { normalizeGroupNetworkLayout } from '@/features/network/logic/networkLayoutHelpers';
import { getPersistedNetworkLayout } from '@/features/network/logic/networkLayoutScopeHelpers';

interface UsePersistedNetworkLayoutArgs {
  scopeKey: string;
  legacyScopeKeys?: readonly string[];
}

export function usePersistedNetworkLayout({
  scopeKey,
  legacyScopeKeys = [],
}: UsePersistedNetworkLayoutArgs) {
  const { groupNetworkLayouts, isLoading } = usePreferenceState();
  const { saveNetworkLayout, resetNetworkLayout } = usePreferenceActions();

  const savedLayout = useMemo(() => {
    const layout = getPersistedNetworkLayout(groupNetworkLayouts, scopeKey, legacyScopeKeys);
    return layout ? normalizeGroupNetworkLayout(layout) : null;
  }, [groupNetworkLayouts, legacyScopeKeys, scopeKey]);

  const persistLayout = useCallback(
    (layout: GroupNetworkLayout) => {
      saveNetworkLayout(scopeKey, normalizeGroupNetworkLayout(layout), legacyScopeKeys);
    },
    [legacyScopeKeys, saveNetworkLayout, scopeKey]
  );

  const resetLayout = useCallback(() => {
    resetNetworkLayout(scopeKey, legacyScopeKeys);
  }, [legacyScopeKeys, resetNetworkLayout, scopeKey]);

  return {
    savedLayout,
    hasSavedLayout: savedLayout !== null,
    isLoading,
    persistLayout,
    resetLayout,
  };
}
