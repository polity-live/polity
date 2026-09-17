import type { ReactNode } from 'react';
import { List, ListFilter } from 'lucide-react';
import { Button } from '../ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CollectionView } from '@/zero/preferences/workspace-schema';

export function CollectionViewToggle({
  value,
  onChange,
  children,
  actionIds,
}: {
  value: CollectionView | null;
  onChange: (view: CollectionView) => void;
  children?: ReactNode;
  actionIds?: Partial<Record<CollectionView, string>>;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('common.workspace.collectionView')}
      className="border-input bg-background inline-flex shrink-0 overflow-hidden rounded-md border"
    >
      {(['cards', 'compact'] as const).map(view => {
        const Icon = view === 'cards' ? List : ListFilter;
        const label = t(
          view === 'cards' ? 'common.workspace.cardsView' : 'common.workspace.compactView'
        );
        return (
          <Button
            key={view}
            type="button"
            variant={value === view ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-none border-0"
            aria-label={label}
            title={label}
            aria-pressed={value === view}
            onClick={() => onChange(view)}
            data-action-id={actionIds?.[view] ?? 'collection.view.select'}
          >
            <Icon className="size-4" />
          </Button>
        );
      })}
      {children}
    </div>
  );
}
