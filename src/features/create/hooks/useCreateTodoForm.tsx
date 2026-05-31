import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useGroupById, useGroupState } from '@/zero/groups/useGroupState';
import { useUserState } from '@/zero/users/useUserState';
import { useTodoMutations } from '@/features/todos/hooks/useTodoMutations';
import { getUserDisplayName } from '@/features/search/utils/searchUtils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from 'sonner';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor';
import { PriorityInput } from '../ui/inputs/PriorityInput';
import { StatusInput } from '../ui/inputs/StatusInput';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { UserSearchInput } from '../ui/inputs/UserSearchInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateInputField, CreateTextareaField, CreateTypeaheadField } from '../ui/CreateFields';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import type { CreateFormConfig } from '../types/create-form.types';

interface CreateTodoSearch {
  groupId?: string;
  returnSection?: 'todos';
}

export function useCreateTodoForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as CreateTodoSearch;
  const { user } = useAuth();
  const { createTodo, isLoading } = useTodoMutations();
  const { allUsers } = useUserState({ includeAllUsers: true });
  const groupIdParam = searchParams.groupId ?? '';
  const returnSection = searchParams.returnSection;
  const [groupId, setGroupId] = useState(() => groupIdParam);
  const [groupName, setGroupName] = useState('');
  const { group } = useGroupById(groupId || undefined);
  const { currentUserMembershipsWithGroups } = useGroupState({
    includeCurrentUserMembershipsWithGroups: true,
  });

  const memberGroupIds = useMemo(
    () => new Set(currentUserMembershipsWithGroups.map(membership => membership.group_id)),
    [currentUserMembershipsWithGroups]
  );

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

  useEffect(() => {
    setGroupId(groupIdParam);
  }, [groupIdParam]);

  useEffect(() => {
    if (!groupId) {
      if (groupName) {
        setGroupName('');
      }
      return;
    }

    const nextGroupName = group?.name ?? '';
    if (nextGroupName && nextGroupName !== groupName) {
      setGroupName(nextGroupName);
    }
  }, [group?.name, groupId, groupName]);

  const syncGroupSearch = useCallback(
    (nextGroupId: string) => {
      navigate({
        to: '/create/todo',
        search: mergeCreateSearchParams(searchParams, {
          groupId: nextGroupId || undefined,
        }),
        replace: true,
      });
    },
    [navigate, searchParams]
  );

  const handleGroupChange = useCallback(
    (nextGroupId: string, nextGroupName: string) => {
      setGroupId(nextGroupId);
      setGroupName(nextGroupName);
      syncGroupSearch(nextGroupId);
    },
    [syncGroupSearch]
  );

  const groupDisplayName = groupName || group?.name || groupId;
  const assigneeNames = assigneeIds
    .map(assigneeId => {
      const matchedUser = allUsers.find(currentUser => currentUser.id === assigneeId);
      return getUserDisplayName(matchedUser) || assigneeId;
    })
    .filter(Boolean);
  const visibilityLabel = groupId
    ? t('pages.create.todo.groupVisibilityLabel', 'Group')
    : visibility === 'public'
      ? t('pages.create.common.public')
      : visibility === 'authenticated'
        ? t('pages.create.common.authenticated')
        : t('pages.create.common.private');

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

      if (returnSection === 'todos' && groupId) {
        navigate({
          to: '/group/$id/operation',
          params: { id: groupId },
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
              <CreateTypeaheadField
                label={t('pages.create.common.group')}
                hint={t(
                  'pages.create.todo.groupHint',
                  'Optionally link this task to one of your groups.'
                )}
                entityTypes={['group']}
                value={groupId || undefined}
                onChange={item => {
                  handleGroupChange(item?.id ?? '', item?.label ?? '');
                }}
                placeholder={t('pages.create.common.searchGroup')}
                filterFn={item => memberGroupIds.has(item.id)}
              />
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
              sections={[
                {
                  title: t('pages.create.todo.priorityLabel'),
                  fields: [
                    ...(groupId
                      ? [{ label: t('pages.create.common.group'), value: groupDisplayName }]
                      : []),
                    {
                      label: t('pages.create.todo.priorityLabel'),
                      value: t(`pages.create.todo.priority.${priority}`),
                    },
                    {
                      label: t('pages.create.todo.statusLabel'),
                      value: t(`features.todos.status.${status}`),
                    },
                    ...(dueDate
                      ? [{ label: t('pages.create.todo.dueDateLabel'), value: dueDate }]
                      : []),
                  ],
                },
                {
                  title: t('pages.create.todo.assignTo'),
                  fields: [
                    ...(assigneeNames.length > 0
                      ? [
                          {
                            label: t('pages.create.todo.assignedTo'),
                            value: assigneeNames.join(', '),
                          },
                        ]
                      : []),
                    {
                      label: t('pages.create.common.visibility'),
                      value: visibilityLabel,
                    },
                    ...(tags.length > 0
                      ? [{ label: t('pages.create.todo.tagsLabel'), value: tags.join(', ') }]
                      : []),
                  ],
                },
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
      visibilityLabel,
      tags,
      assigneeNames,
      memberGroupIds,
      isLoading,
      groupId,
      groupDisplayName,
      handleGroupChange,
      t,
    ]
  );

  return config;
}
