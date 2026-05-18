import { useCallback, useMemo } from 'react';
import {
  usePreferenceActions,
  usePreferenceState,
  type GroupNetworkLayout,
} from '@/zero/preferences';

export function useGroupNetworkLayout(groupId: string) {
  const { groupNetworkLayouts, isLoading } = usePreferenceState();
  const { saveGroupNetworkLayout, resetGroupNetworkLayout } = usePreferenceActions();

  const savedLayout = useMemo(
    () => groupNetworkLayouts[groupId] ?? null,
    [groupId, groupNetworkLayouts]
  );

  const persistLayout = useCallback(
    (layout: GroupNetworkLayout) => {
      saveGroupNetworkLayout(groupId, layout);
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
