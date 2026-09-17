import { createContext, useContext, useSyncExternalStore } from 'react';
import type {
  CollectionArea,
  CollectionView,
  WorkspaceDisplay,
} from '@/zero/preferences/workspace-schema';

export const CollectionPreferencesContext = createContext<{
  userId: string;
  display: WorkspaceDisplay;
  isLoading: boolean;
} | null>(null);
const sessionViews = new Map<string, CollectionView>();
export const pendingCollectionViews = new Map<
  string,
  { userId: string; area: CollectionArea; view: CollectionView }
>();
const listeners = new Set<() => void>();
let revision = 0;
export const subscribeCollectionViews = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const collectionRevision = () => revision;

export function useCollectionView(area: CollectionArea, defaultView: CollectionView = 'cards') {
  const preferences = useContext(CollectionPreferencesContext);
  useSyncExternalStore(subscribeCollectionViews, collectionRevision, () => 0);
  const userId = preferences?.userId ?? 'guest';
  const key = `${userId}:${area}`;
  const stored = preferences?.display.collectionViews?.[area];
  return {
    view: sessionViews.get(key) ?? stored ?? defaultView,
    hasPreference: sessionViews.has(key) || stored !== undefined,
    isLoading: preferences?.isLoading ?? false,
    setView: (view: CollectionView) => {
      sessionViews.set(key, view);
      if (userId !== 'guest') pendingCollectionViews.set(key, { userId, area, view });
      revision += 1;
      listeners.forEach(listener => listener());
    },
  };
}
