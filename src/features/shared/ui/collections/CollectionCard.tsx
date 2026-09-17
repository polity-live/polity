import { createContext, useContext, type ReactNode } from 'react';
import type { EntityListRowProps } from './EntityListRow';
import { MoreHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const CompactCardContext = createContext<EntityListRowProps | null>(null);
export const useCompactCard = () => useContext(CompactCardContext);

/** Opt-in adapter: existing card controllers and their permission-aware actions stay mounted. */
export function CollectionCard({
  compact,
  model,
  children,
}: {
  compact: boolean;
  model: EntityListRowProps;
  children: ReactNode;
}) {
  return (
    <CompactCardContext.Provider value={compact ? model : null}>
      {children}
    </CompactCardContext.Provider>
  );
}

export function CollectionActionsMenu({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('common.actions.more')}
          data-action-id="shared.collection.menu.open"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[calc(100vw-2rem)]">
        {children}
      </PopoverContent>
    </Popover>
  );
}
