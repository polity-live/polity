import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';

import type { TerminalFilter, VisibilityFilter } from '../ui/TerminalHeader';

const FILTERS: { value: TerminalFilter; labelKey: string }[] = [
  { value: 'live', labelKey: 'features.timeline.terminal.filters.live' },
  { value: 'opening_soon', labelKey: 'features.timeline.terminal.filters.openingSoon' },
  { value: 'recently_closed', labelKey: 'features.timeline.terminal.filters.recentlyClosed' },
  { value: 'all', labelKey: 'features.timeline.terminal.filters.all' },
];

export function useTerminalHeaderController(args: {
  visibilityFilter: VisibilityFilter;
  searchQuery: string;
}) {
  const { t } = useTranslation();
  const [showSearch, setShowSearch] = useState(false);

  const visibilityLabel =
    args.visibilityFilter === 'all'
      ? t('features.timeline.terminal.visibility.all')
      : args.visibilityFilter === 'public'
        ? t('features.timeline.terminal.visibility.public')
        : args.visibilityFilter === 'authenticated'
          ? t('features.timeline.terminal.visibility.authenticated')
          : t('features.timeline.terminal.visibility.private');

  const handleSearchBlur = () => {
    if (!args.searchQuery) {
      setShowSearch(false);
    }
  };

  return {
    showSearch,
    filters: FILTERS.map(filter => ({
      value: filter.value,
      label: t(filter.labelKey),
    })),
    visibilityLabel,
    labels: {
      title: t('features.timeline.terminal.title'),
      urgent: t('features.timeline.terminal.urgent'),
      active: t('features.timeline.terminal.active'),
      all: t('features.timeline.terminal.visibility.all'),
      public: t('features.timeline.terminal.visibility.public'),
      authenticated: t('features.timeline.terminal.visibility.authenticated'),
      private: t('features.timeline.terminal.visibility.private'),
      searchPlaceholder: t('features.timeline.terminal.searchPlaceholder'),
      density: t('features.timeline.terminal.settings.density'),
      refreshRate: t('features.timeline.terminal.settings.refreshRate'),
      soundAlerts: t('features.timeline.terminal.settings.soundAlerts'),
    },
    onShowSearch: () => setShowSearch(true),
    onSearchBlur: handleSearchBlur,
  };
}
