import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';
import { usePreferenceState } from './usePreferenceState';
import type {
  CreateFormStyle,
  Theme,
  PreferenceLanguage,
  PreferenceNavigationView,
  GroupNetworkLayout,
} from './schema';

/**
 * Action hook for user preference mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function usePreferenceActions() {
  const zero = useZero();
  const { t } = useTranslation();
  const { preference, isLoading, groupNetworkLayouts } = usePreferenceState();

  const upsertPreference = useCallback(
    (fields: {
      create_form_style?: CreateFormStyle;
      theme?: Theme;
      language?: PreferenceLanguage;
      navigation_view?: PreferenceNavigationView;
      group_network_layouts?: Record<string, GroupNetworkLayout>;
    }) => {
      // Don't attempt mutations while preference data is still loading —
      // preference may appear null even though a row exists on the server,
      // which would cause a duplicate key error on INSERT.
      if (isLoading) return;

      if (preference) {
        const result = zero.mutate(
          mutators.preferences.update({
            id: preference.id,
            ...fields,
          })
        );
        onServerError(result, msg => console.error('Preference update failed:', msg));
      } else {
        const result = zero.mutate(
          mutators.preferences.create({
            id: crypto.randomUUID(),
            create_form_style: fields.create_form_style ?? 'carousel',
            theme: fields.theme ?? 'system',
            language: fields.language ?? 'en',
            navigation_view: fields.navigation_view ?? 'asButtonList',
            group_network_layouts: fields.group_network_layouts ?? {},
          })
        );
        onServerError(result, msg => console.error('Preference create failed:', msg));
      }
    },
    [zero, preference, isLoading]
  );

  const updateFormStyle = useCallback(
    (style: CreateFormStyle) => {
      upsertPreference({ create_form_style: style });
      toast.success(t('pages.create.preferences.formStyleUpdated'));
    },
    [upsertPreference, t]
  );

  const updateTheme = useCallback(
    (theme: Theme) => {
      upsertPreference({ theme });
    },
    [upsertPreference]
  );

  const updateLanguage = useCallback(
    (language: PreferenceLanguage) => {
      upsertPreference({ language });
    },
    [upsertPreference]
  );

  const updateNavigationView = useCallback(
    (navigationView: PreferenceNavigationView) => {
      upsertPreference({ navigation_view: navigationView });
    },
    [upsertPreference]
  );

  const saveGroupNetworkLayout = useCallback(
    (groupId: string, layout: GroupNetworkLayout) => {
      upsertPreference({
        group_network_layouts: {
          ...groupNetworkLayouts,
          [groupId]: layout,
        },
      });
      toast.success(t('common.network.layoutSaved'));
    },
    [groupNetworkLayouts, t, upsertPreference]
  );

  const resetGroupNetworkLayout = useCallback(
    (groupId: string) => {
      const nextLayouts = Object.fromEntries(
        Object.entries(groupNetworkLayouts).filter(([currentGroupId]) => currentGroupId !== groupId)
      );
      upsertPreference({ group_network_layouts: nextLayouts });
      toast.success(t('common.network.layoutReset'));
    },
    [groupNetworkLayouts, t, upsertPreference]
  );

  return {
    updateFormStyle,
    updateTheme,
    updateLanguage,
    updateNavigationView,
    saveGroupNetworkLayout,
    resetGroupNetworkLayout,
  };
}
