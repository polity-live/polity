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
  DecisionTerminalDashboardConfig,
  PreferenceCurrency,
} from './schema';
import {
  resetPersistedNetworkLayouts,
  savePersistedNetworkLayouts,
} from '@/features/network/logic/networkLayoutScopeHelpers';

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
      display_currency?: PreferenceCurrency;
      navigation_view?: PreferenceNavigationView;
      group_network_layouts?: Record<string, GroupNetworkLayout>;
      decision_terminal_dashboard?: DecisionTerminalDashboardConfig;
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
        return result;
      } else {
        const result = zero.mutate(
          mutators.preferences.create({
            id: crypto.randomUUID(),
            create_form_style: fields.create_form_style ?? 'carousel',
            theme: fields.theme ?? 'system',
            language: fields.language ?? 'en',
            display_currency: fields.display_currency ?? 'EUR',
            navigation_view: fields.navigation_view ?? 'asButtonList',
            group_network_layouts: fields.group_network_layouts ?? {},
            decision_terminal_dashboard: fields.decision_terminal_dashboard,
          })
        );
        onServerError(result, msg => console.error('Preference create failed:', msg));
        return result;
      }
    },
    [zero, preference, isLoading]
  );

  const updateFormStyle = useCallback(
    (style: CreateFormStyle) => {
      const result = upsertPreference({ create_form_style: style });
      toast.success(t('pages.create.preferences.formStyleUpdated'));
      return result;
    },
    [upsertPreference, t]
  );

  const updateTheme = useCallback(
    (theme: Theme) => {
      return upsertPreference({ theme });
    },
    [upsertPreference]
  );

  const updateLanguage = useCallback(
    (language: PreferenceLanguage) => {
      return upsertPreference({ language });
    },
    [upsertPreference]
  );

  const updateDisplayCurrency = useCallback(
    (currency: PreferenceCurrency) => upsertPreference({ display_currency: currency }),
    [upsertPreference]
  );

  const updateNavigationView = useCallback(
    (navigationView: PreferenceNavigationView) => {
      return upsertPreference({ navigation_view: navigationView });
    },
    [upsertPreference]
  );

  const saveNetworkLayout = useCallback(
    (scopeKey: string, layout: GroupNetworkLayout) => {
      const result = upsertPreference({
        group_network_layouts: savePersistedNetworkLayouts({
          layouts: groupNetworkLayouts,
          scopeKey,
          layout,
        }),
      });
      toast.success(t('common.network.layoutSaved'));
      return result;
    },
    [groupNetworkLayouts, t, upsertPreference]
  );

  const resetNetworkLayout = useCallback(
    (scopeKey: string) => {
      const nextLayouts = resetPersistedNetworkLayouts({
        layouts: groupNetworkLayouts,
        scopeKey,
      });
      const result = upsertPreference({ group_network_layouts: nextLayouts });
      toast.success(t('common.network.layoutReset'));
      return result;
    },
    [groupNetworkLayouts, t, upsertPreference]
  );

  const saveGroupNetworkLayout = useCallback(
    (groupId: string, layout: GroupNetworkLayout) => {
      return saveNetworkLayout(`group:${groupId}`, layout);
    },
    [saveNetworkLayout]
  );

  const resetGroupNetworkLayout = useCallback(
    (groupId: string) => {
      return resetNetworkLayout(`group:${groupId}`);
    },
    [resetNetworkLayout]
  );

  const saveDecisionTerminalDashboard = useCallback(
    (dashboard: DecisionTerminalDashboardConfig) => {
      return upsertPreference({ decision_terminal_dashboard: dashboard });
    },
    [upsertPreference]
  );

  return {
    updateFormStyle,
    updateTheme,
    updateLanguage,
    updateDisplayCurrency,
    updateNavigationView,
    saveNetworkLayout,
    resetNetworkLayout,
    saveGroupNetworkLayout,
    resetGroupNetworkLayout,
    saveDecisionTerminalDashboard,
  };
}
