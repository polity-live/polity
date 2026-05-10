import { useState, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useGroupById } from '@/zero/groups/useGroupState';
import { useTodoMutations } from '@/features/todos/hooks/useTodoMutations';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from 'sonner';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor';
import { PriorityInput } from '../ui/inputs/PriorityInput';
import { StatusInput } from '../ui/inputs/StatusInput';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { UserSearchInput } from '../ui/inputs/UserSearchInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateInputField, CreateTextareaField } from '../ui/CreateFields';
import type { CreateFormConfig } from '../types/create-form.types';

interface CreateTodoSearch {
  groupId?: string;
  returnGroupId?: string;
  returnSection?: 'todos';
}

export function useCreateTodoForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as CreateTodoSearch;
  const { user } = useAuth();
  const { createTodo, isLoading } = useTodoMutations();

  const groupId = searchParams.groupId ?? '';
  const returnGroupId = searchParams.returnGroupId;
  const returnSection = searchParams.returnSection;
  const { group } = useGroupById(groupId || undefined);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed' | 'cancelled'>(
    'pending'
  );
  const [dueDate, setDueDate] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'authenticated' | 'private'>('private');
  const [tags, setTags] = useState<string[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const groupDisplayName = group?.name ?? groupId;

  const handleSubmit = async () => {
    if (!title.trim() || !user?.id) return;
    try {
      await createTodo({
        title: title.trim(),
        description: description.trim() || undefined,
        ownerId: user.id,
        assigneeId: assigneeIds.length > 0 ? assigneeIds[0] : user.id,
        priority,
        status,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
        tags,
        groupId: groupId || undefined,
        visibility: groupId ? 'group' : visibility,
      });
      toast.success(t('pages.create.success.created'));

      if (returnGroupId && returnSection === 'todos') {
        navigate({
          to: '/group/$id/operation',
          params: { id: returnGroupId },
          hash: returnSection,
        });
        return;
      }

      navigate({ to: '/todos' });
    } catch {
      toast.error(t('pages.create.error.createFailed'));
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'todo',
      title: 'pages.create.todo.title',
      isSubmitting: isLoading,
      onSubmit: handleSubmit,
      steps: [
        {
          label: t('pages.create.todo.titleLabel'),
          isValid: () => !!title.trim(),
          content: (
            <div className="space-y-4">
              {groupId ? (
                <div className="bg-muted/40 space-y-2 rounded-md border px-3 py-2">
                  <p className="text-sm font-medium">{t('pages.create.common.group')}</p>
                  <p className="text-muted-foreground text-sm">{groupDisplayName}</p>
                </div>
              ) : null}
              <CreateInputField
                label={t('pages.create.todo.titleLabel')}
                required
                hint={t('pages.create.todo.tips.title')}
                value={title}
                onValueChange={setTitle}
                placeholder={t('pages.create.todo.titlePlaceholder')}
              />
              <CreateTextareaField
                label={t('pages.create.todo.descriptionLabel')}
                hint={t('pages.create.todo.tips.description')}
                value={description}
                onValueChange={setDescription}
                placeholder={t('pages.create.todo.descriptionPlaceholder')}
                rows={4}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.todo.priorityLabel'),
          isValid: () => true,
          content: (
            <div className="space-y-4">
              <PriorityInput value={priority} onChange={setPriority} />
              <StatusInput value={status} onChange={setStatus} />
            </div>
          ),
        },
        {
          label: t('pages.create.todo.assignTo'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <UserSearchInput
                value={assigneeIds}
                onChange={setAssigneeIds}
                label={t('pages.create.todo.assignToLabel')}
                placeholder={t('pages.create.todo.assignToPlaceholder')}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.event.settings'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <CreateInputField
                label={t('pages.create.todo.dueDateOptional')}
                value={dueDate}
                onValueChange={setDueDate}
                type="date"
              />
              {groupId ? (
                <div className="bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-sm">
                  {t(
                    'pages.create.todo.groupVisibilityHint',
                    'This task will be visible to the selected group.'
                  )}
                </div>
              ) : (
                <VisibilityInput value={visibility} onChange={setVisibility} />
              )}
              <HashtagEditor
                value={tags}
                onChange={setTags}
                label={t('pages.create.todo.tagsOptional')}
                placeholder={t('pages.create.todo.tagPlaceholder')}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!title.trim(),
          content: (
            <CreateSummaryStep
              entityType="todo"
              badge={t('pages.create.todo.reviewBadge')}
              title={title || t('pages.create.todo.titlePlaceholder')}
              subtitle={description || undefined}
              fields={[
                ...(groupId
                  ? [{ label: t('pages.create.common.group'), value: groupDisplayName }]
                  : []),
                {
                  label: t('pages.create.todo.priorityLabel'),
                  value: t(`pages.create.todo.priority.${priority}`),
                },
                { label: t('pages.create.todo.statusLabel'), value: status },
                ...(assigneeIds.length > 0
                  ? [
                      {
                        label: t('pages.create.todo.assignedTo'),
                        value: `${assigneeIds.length} user(s)`,
                      },
                    ]
                  : []),
                ...(dueDate
                  ? [{ label: t('pages.create.todo.dueDateLabel'), value: dueDate }]
                  : []),
                {
                  label: t('pages.create.common.visibility'),
                  value: groupId
                    ? t('pages.create.todo.groupVisibilityLabel', 'Group')
                    : visibility,
                },
                ...(tags.length > 0
                  ? [{ label: t('pages.create.todo.tagsLabel'), value: tags.join(', ') }]
                  : []),
              ]}
            />
          ),
        },
      ],
    }),
    [
      title,
      description,
      priority,
      status,
      assigneeIds,
      dueDate,
      visibility,
      tags,
      isLoading,
      groupId,
      groupDisplayName,
      t,
    ]
  );

  return config;
}
