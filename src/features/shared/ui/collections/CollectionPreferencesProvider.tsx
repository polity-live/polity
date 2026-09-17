import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspacePreferences } from '@/zero/preferences/useWorkspacePreferences';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from '../ui/sonner';
import {
  CollectionPreferencesContext,
  pendingCollectionViews,
  subscribeCollectionViews,
  collectionRevision,
} from './useCollectionView';

function ConnectedPreferences({ children, userId }: { children: ReactNode; userId: string }) {
  const { display, setDisplay, isLoading } = useWorkspacePreferences();
  const { t } = useTranslation();
  const revision = useSyncExternalStore(subscribeCollectionViews, collectionRevision, () => 0);
  const writer = useRef(setDisplay);
  writer.current = setDisplay;
  useEffect(() => {
    if (isLoading) return;
    for (const [key, update] of pendingCollectionViews) {
      if (update.userId !== userId) continue;
      pendingCollectionViews.delete(key);
      void writer
        .current({ collectionViews: { [update.area]: update.view } })
        .catch(() => toast.error(t('common.workspace.saveFailed')));
    }
  }, [isLoading, revision, t, userId]);
  return (
    <CollectionPreferencesContext.Provider value={{ userId, display, isLoading }}>
      {children}
    </CollectionPreferencesContext.Provider>
  );
}
export function CollectionPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? (
    <ConnectedPreferences userId={user.id}>{children}</ConnectedPreferences>
  ) : (
    <>{children}</>
  );
}
