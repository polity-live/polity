import { useRef, useState } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { Calendar, Users, Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { PreviewButton } from '@/features/shared/ui/preview/WorkspacePreview';
import { Button } from '@/features/shared/ui/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { UserSearchInput } from '@/features/create/ui/inputs/UserSearchInput';
import { TodoDeadlineInput } from '@/features/create/ui/inputs/TodoDeadlineInput';
import { useTodoAssigneeOptions } from '../hooks/useTodoAssigneeOptions';
import {
  todoDeadlineToFormValues,
  resolveTodoDeadlineTimestamp,
  formatTodoDate,
} from '../utils/todoFormatters';
import { getTodoTutorialAnchor } from '../logic/tutorialTodoAnchor';
import type { Todo, TodoStatus } from '../types/todo.types';

function AssigneePicker({
  todo,
  disabled,
  onChange,
}: {
  todo: Todo;
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const { allowedUserIds, isLoading } = useTodoAssigneeOptions(todo.group_id);
  return (
    <UserSearchInput
      label={t('features.todos.assignee.title')}
      multi
      value={todo.assignments?.flatMap(row => (row.user_id ? [row.user_id] : [])) ?? []}
      onChange={onChange}
      allowedUserIds={allowedUserIds}
      disabled={disabled || isLoading}
      disablePortal
    />
  );
}

function DeadlinePicker({
  todo,
  pending,
  save,
}: {
  todo: Todo;
  pending: boolean;
  save: (date: number | null) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => todoDeadlineToFormValues(todo.due_date));
  return (
    <div className="space-y-3">
      <TodoDeadlineInput dueDate={draft.dueDate} dueTime={draft.dueTime} onChange={setDraft} />
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          void save(resolveTodoDeadlineTimestamp(todo.due_date, draft.dueDate, draft.dueTime))
        }
      >
        {t(pending ? 'common.workspace.saving' : 'common.actions.save')}
      </Button>
    </div>
  );
}

export function CompactTodoRow({
  todo,
  canManageTodos = true,
  onTodoClick,
}: {
  todo: Todo;
  canManageTodos?: boolean;
  onTodoClick?: (todo: Todo) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canManage } = usePermissions({ groupId: todo.group_id ?? undefined });
  const canEdit =
    canManageTodos &&
    !todo.archived_at &&
    Boolean(user?.id && (todo.group_id ? canManage('groupTodos') : todo.creator_id === user.id));
  const zero = useZero();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [assigneesOpen, setAssigneesOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const run = async (operation: () => Promise<void>) => {
    if (busy.current || !canEdit) return false;
    busy.current = true;
    setPending(true);
    setError(false);
    try {
      await operation();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const update = (fields: Parameters<typeof mutators.todos.update>[0]) =>
    run(() => serverConfirmed(zero.mutate(mutators.todos.update(fields))));
  const href = `/todos/${todo.id}`;
  return (
    <div
      data-workspace-row
      data-tutorial-anchor={getTodoTutorialAnchor(todo)}
      className="hover:bg-muted/40 px-2 py-2"
    >
      <div className="flex min-h-12 flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
        <select
          aria-label={`${t('features.todos.detail.status')}: ${todo.title}`}
          disabled={!canEdit || pending}
          className="border-input bg-background h-8 w-24 shrink-0 rounded border px-1 text-xs disabled:opacity-70 sm:w-32"
          value={todo.status ?? 'pending'}
          onChange={event => {
            const status = event.target.value as TodoStatus;
            void update({
              id: todo.id,
              status,
              completed_at: status === 'completed' ? Date.now() : null,
            });
          }}
        >
          {(['pending', 'in_progress', 'completed', 'cancelled'] as const).map(status => (
            <option key={status} value={status}>
              {t(`features.todos.status.${status}`)}
            </option>
          ))}
        </select>
        <div className="order-first min-w-0 basis-full md:order-none md:flex-1 md:basis-auto">
          <SmartLink
            href={href}
            data-workspace-open
            title={t('common.workspace.previewHint')}
            className="block truncate text-sm font-medium hover:underline"
          >
            {todo.title}
          </SmartLink>
          <span className="text-muted-foreground block truncate text-xs">
            {todo.group?.name || todo.description}
          </span>
        </div>
        <Popover open={assigneesOpen} onOpenChange={setAssigneesOpen}>
          <PopoverTrigger asChild data-action-id="todos.compact.assignee.open">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canEdit}
              data-action-id="todos.compact.assignee.open"
              aria-label={t('features.todos.assignee.title')}
              title={todo.assignments
                ?.map(row => [row.user?.first_name, row.user?.last_name].filter(Boolean).join(' '))
                .join(', ')}
            >
              <Users className="size-4" />
              <span className="hidden sm:inline">{todo.assignments?.length || '—'}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]">
            {assigneesOpen ? (
              <AssigneePicker
                todo={todo}
                disabled={pending}
                onChange={ids =>
                  void run(async () => {
                    const assignments = todo.assignments ?? [];
                    for (const assignment of assignments)
                      if (assignment.user_id && !ids.includes(assignment.user_id))
                        await serverConfirmed(
                          zero.mutate(mutators.todos.unassign({ id: assignment.id }))
                        );
                    for (const userId of ids)
                      if (!assignments.some(row => row.user_id === userId))
                        await serverConfirmed(
                          zero.mutate(
                            mutators.todos.assign({
                              id: crypto.randomUUID(),
                              todo_id: todo.id,
                              user_id: userId,
                              role: 'assignee',
                            })
                          )
                        );
                  })
                }
              />
            ) : null}
            {error ? (
              <p role="alert" className="text-destructive mt-2 text-xs">
                {t('common.workspace.saveFailed')}
              </p>
            ) : null}
          </PopoverContent>
        </Popover>
        <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
          <PopoverTrigger asChild data-action-id="todos.compact.deadline.open">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canEdit}
              data-action-id="todos.compact.deadline.open"
              aria-label={t('features.todos.dueDate.title')}
              title={todo.due_date ? formatTodoDate(todo.due_date) : undefined}
            >
              <Calendar className="size-4" />
              <span className="hidden text-xs lg:inline">
                {todo.due_date ? formatTodoDate(todo.due_date) : '—'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]">
            {deadlineOpen ? (
              <DeadlinePicker
                todo={todo}
                pending={pending}
                save={async due_date => {
                  const saved = await update({ id: todo.id, due_date });
                  if (saved) setDeadlineOpen(false);
                  return saved;
                }}
              />
            ) : null}
            {error ? (
              <p role="alert" className="text-destructive mt-2 text-xs">
                {t('common.workspace.saveFailed')}
              </p>
            ) : null}
          </PopoverContent>
        </Popover>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-label={t('common.workspace.saving')} />
        ) : null}
        <PreviewButton href={href} />
        {onTodoClick && canEdit ? (
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => onTodoClick(todo)}
          >
            {t('common.actions.edit')}
          </Button>
        ) : null}
      </div>
      {error && !deadlineOpen && !assigneesOpen ? (
        <p role="alert" className="text-destructive text-xs">
          {t('common.workspace.saveFailed')}
        </p>
      ) : null}
    </div>
  );
}
