import type { ReactNode } from 'react';
import type { CollectionView } from '@/zero/preferences/workspace-schema';
import { CollectionViewToggle } from './CollectionViewToggle';

export function CollectionToolbar({
  search,
  view,
  onViewChange,
  actions,
}: {
  search: ReactNode;
  view: CollectionView;
  onViewChange: (value: CollectionView) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-start gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <div className="min-w-0 flex-1">{search}</div>
        <CollectionViewToggle value={view} onChange={onViewChange} />
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
