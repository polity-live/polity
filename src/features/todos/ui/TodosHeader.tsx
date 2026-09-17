import { Link } from '@tanstack/react-router';
import { Button } from '@/features/shared/ui/ui/button';
import { LayoutList, LayoutGrid, Plus } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export type ViewMode = 'list' | 'kanban';

interface TodosHeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export function TodosHeader({ viewMode, setViewMode }: TodosHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex gap-2">
        <div
          className="border-input bg-background inline-flex shrink-0 overflow-hidden rounded-md border"
          role="group"
          aria-label={t('features.todos.title')}
        >
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-none border-0"
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            aria-label={t('features.todos.view.list')}
            data-action-id="todos.header.view.list"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-none border-0"
            aria-pressed={viewMode === 'kanban'}
            onClick={() => setViewMode('kanban')}
            aria-label={t('features.todos.view.kanban')}
            data-action-id="todos.header.view.kanban"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
        <Button
          asChild
          className="size-9 p-0 sm:w-auto sm:px-3"
          aria-label={t('features.todos.create.newTodo')}
          data-action-id="todos.header.create"
        >
          <Link to="/create/todo" data-action-id="todos.header.create">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('features.todos.create.newTodo')}</span>
          </Link>
        </Button>
      </div>
    </>
  );
}
