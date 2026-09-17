import { useZero } from '@rocicorp/zero/react';
import { useMemo } from 'react';
import { usePreferenceState } from './usePreferenceState';
import { mutators } from '../mutators';
import { serverConfirmed } from '../mutate-with-server-check';
import {
  readWorkspacePreferences,
  type WorkspaceDisplay,
  type WorkspaceFavorite,
} from './workspace-schema';

export function useWorkspacePreferences() {
  const zero = useZero();
  const { preference, isLoading } = usePreferenceState();
  const workspace = useMemo(
    () => readWorkspacePreferences(preference?.workspace_preferences),
    [preference?.workspace_preferences]
  );
  return {
    ...workspace,
    isLoading,
    setFavorite: async (favorite: WorkspaceFavorite, active: boolean) => {
      if (isLoading) throw new Error('Preferences are still loading');
      await serverConfirmed(
        zero.mutate(
          mutators.preferences.setWorkspaceFavorite({
            id: crypto.randomUUID(),
            favorite: { ...favorite, title: favorite.title.slice(0, 240) },
            active,
          })
        )
      );
    },
    setDisplay: async (display: WorkspaceDisplay) => {
      if (isLoading) throw new Error('Preferences are still loading');
      await serverConfirmed(
        zero.mutate(mutators.preferences.setWorkspaceDisplay({ id: crypto.randomUUID(), display }))
      );
    },
  };
}
