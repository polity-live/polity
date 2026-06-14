import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';

import type { TerminalFilter, VisibilityFilter } from '../ui/TerminalHeader';

const FILTERS: { value: TerminalFilter; labelKey: string }[] = [
  { value: 'live', labelKey: 'timeline.terminal.filters.live' },
  { value: 'opening_soon', labelKey: 'timeline.terminal.filters.openingSoon' },
  { value: 'recently_closed', labelKey: 'timeline.terminal.filters.recentlyClosed' },
  { value: 'all', labelKey: 'timeline.terminal.filters.all' },
];

export function useTerminalHeaderController(args: {
  visibilityFilter: VisibilityFilter;
  searchQuery: string;
}) {
  const { t } = useTranslation();
  const [showSearch, setShowSearch] = useState(false);

  const visibilityLabel =
    args.visibilityFilter === 'all'
      ? t('timeline.terminal.visibility.all')
      : args.visibilityFilter === 'public'
        ? t('timeline.terminal.visibility.public')
        : args.visibilityFilter === 'authenticated'
          ? t('timeline.terminal.visibility.authenticated')
          : t('timeline.terminal.visibility.private');

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
      title: t('timeline.terminal.title'),
      urgent: t('timeline.terminal.urgent'),
      active: t('timeline.terminal.active'),
      all: t('timeline.terminal.visibility.all'),
      public: t('timeline.terminal.visibility.public'),
      authenticated: t('timeline.terminal.visibility.authenticated'),
      private: t('timeline.terminal.visibility.private'),
      searchPlaceholder: t('timeline.terminal.searchPlaceholder'),
      density: t('timeline.terminal.settings.density'),
      refreshRate: t('timeline.terminal.settings.refreshRate'),
      soundAlerts: t('timeline.terminal.settings.soundAlerts'),
    },
    onShowSearch: () => setShowSearch(true),
    onSearchBlur: handleSearchBlur,
  };
}
