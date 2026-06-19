import {
  useSwipeNavigation,
  type SwipeNavigationHandlers,
  type UseSwipeNavigationOptions,
} from './useSwipeNavigation';

export type UseWizardSwipeNavigationOptions = UseSwipeNavigationOptions;
export type WizardSwipeNavigationHandlers = SwipeNavigationHandlers;

export function useWizardSwipeNavigation(options: UseWizardSwipeNavigationOptions) {
  return useSwipeNavigation(options);
}
