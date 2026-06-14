'use client';

import { useTerminalHeaderController } from '@/features/decision-terminal/hooks/useTerminalHeaderController';

import { TerminalHeaderView } from './TerminalHeaderView';

export type TerminalFilter = 'live' | 'opening_soon' | 'recently_closed' | 'all';
export type VisibilityFilter = 'all' | 'public' | 'authenticated' | 'private';

export interface TerminalHeaderProps {
  activeFilter: TerminalFilter;
  onFilterChange: (filter: TerminalFilter) => void;
  visibilityFilter: VisibilityFilter;
  onVisibilityFilterChange: (filter: VisibilityFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  urgentCount?: number;
  activeCount?: number;
  className?: string;
}

export function TerminalHeader({
  urgentCount = 0,
  activeCount = 0,
  ...props
}: TerminalHeaderProps) {
  const controller = useTerminalHeaderController({
    visibilityFilter: props.visibilityFilter,
    searchQuery: props.searchQuery,
  });

  return (
    <TerminalHeaderView
      {...props}
      urgentCount={urgentCount}
      activeCount={activeCount}
      {...controller}
    />
  );
}
