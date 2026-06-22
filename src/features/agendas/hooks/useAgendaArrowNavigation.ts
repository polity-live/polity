import { useHorizontalArrowNavigation } from '@/features/shared/hooks/useHorizontalArrowNavigation';

interface AgendaArrowNavigationState {
  canNavigate: boolean;
  isLoading: boolean;
  hasPreviousItem: boolean;
  hasNextItem: boolean;
  canMoveToNextItem: boolean;
  currentAgendaItem: unknown;
  moveToPreviousItem: () => void | Promise<void>;
  moveToNextItem: () => void | Promise<void>;
}

interface ChangeRequestArrowNavigationState {
  enabled: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void | Promise<void>;
  onNext: () => void | Promise<void>;
}

interface UseAgendaArrowNavigationOptions {
  agendaNav: AgendaArrowNavigationState;
  changeRequestNav?: ChangeRequestArrowNavigationState;
}

export function useAgendaArrowNavigation({
  agendaNav,
  changeRequestNav,
}: UseAgendaArrowNavigationOptions) {
  const isChangeRequestNavigationActive = Boolean(changeRequestNav?.enabled);

  useHorizontalArrowNavigation({
    mode: 'global',
    enabled: isChangeRequestNavigationActive || agendaNav.canNavigate,
    disabled: agendaNav.isLoading,
    canGoPrev: isChangeRequestNavigationActive
      ? Boolean(changeRequestNav?.hasPrevious)
      : agendaNav.hasPreviousItem,
    canGoNext: isChangeRequestNavigationActive
      ? Boolean(changeRequestNav?.hasNext)
      : agendaNav.hasNextItem &&
        agendaNav.canMoveToNextItem &&
        Boolean(agendaNav.currentAgendaItem),
    onGoPrev: isChangeRequestNavigationActive
      ? changeRequestNav?.onPrevious
      : agendaNav.moveToPreviousItem,
    onGoNext: isChangeRequestNavigationActive ? changeRequestNav?.onNext : agendaNav.moveToNextItem,
  });
}
