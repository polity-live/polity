import { CollectionViewToggle } from './CollectionViewToggle';
import { createContext, useContext, type ReactNode } from 'react';
import type { CollectionArea, CollectionView } from '@/zero/preferences/workspace-schema';
import { useCollectionView } from './useCollectionView';
import { CollectionToolbar } from './CollectionToolbar';

const CollectionContext = createContext<{
  view: CollectionView;
  setView: (view: CollectionView) => void;
} | null>(null);
export function CollectionScope({ area, children }: { area: CollectionArea; children: ReactNode }) {
  const state = useCollectionView(area);
  return <CollectionContext.Provider value={state}>{children}</CollectionContext.Provider>;
}
export const useCollectionPresentation = () => useContext(CollectionContext);
export function CollectionControls({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  const state = useCollectionPresentation();
  return state ? (
    <CollectionToolbar
      search={children}
      view={state.view}
      onViewChange={state.setView}
      actions={actions}
    />
  ) : (
    <>
      {children}
      {actions}
    </>
  );
}

export function CollectionToggle() {
  const state = useCollectionPresentation();
  return state ? <CollectionViewToggle value={state.view} onChange={state.setView} /> : null;
}
