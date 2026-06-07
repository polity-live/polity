import { useCallback, useMemo } from 'react';
import {
  usePreferenceActions,
  usePreferenceState,
  type GroupNetworkLayout,
} from '@/zero/preferences';
import { normalizeGroupNetworkLayout } from '@/features/network/logic/networkLayoutHelpers';

export function useGroupNetworkLayout(groupId: string) {
  const { groupNetworkLayouts, isLoading } = usePreferenceState();
  const { saveGroupNetworkLayout, resetGroupNetworkLayout } = usePreferenceActions();

  const savedLayout = useMemo(() => {
    const layout = groupNetworkLayouts[groupId];
    return layout ? normalizeGroupNetworkLayout(layout) : null;
  }, [groupId, groupNetworkLayouts]);

  const persistLayout = useCallback(
    (layout: GroupNetworkLayout) => {
      saveGroupNetworkLayout(groupId, normalizeGroupNetworkLayout(layout));
    },
    [groupId, saveGroupNetworkLayout]
  );

  const resetLayout = useCallback(() => {
    resetGroupNetworkLayout(groupId);
  }, [groupId, resetGroupNetworkLayout]);

  return {
    savedLayout,
    hasSavedLayout: savedLayout !== null,
    isLoading,
    persistLayout,
    resetLayout,
  };
}
