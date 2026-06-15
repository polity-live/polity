import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useGroupById, useGroupState } from '@/zero/groups/useGroupState';
import { useUserState } from '@/zero/users/useUserState';
import { useTodoMutations } from '@/features/todos/hooks/useTodoMutations';
import { useCommonState } from '@/zero/common/useCommonState';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import { getUserDisplayName } from '@/features/search/utils/searchUtils';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { PriorityInput } from '../ui/inputs/PriorityInput';
import { StatusInput } from '../ui/inputs/StatusInput';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { UserSearchInput } from '../ui/inputs/UserSearchInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateInlineNotice } from '../ui/CreateInlineNotice';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';

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
  const { userHashtags } = useCommonState({ user_id: user?.id });
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
  const preferredHashtagSuggestions = useMemo(
    () => extractHashtagTags(userHashtags),
    [userHashtags]
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
    ? t('pages.create.todo.groupVisibilityLabel')
    : visibility === translateText('generated.inline.0030_public_61c9b2b1')
      ? t('pages.create.common.public')
      : visibility === translateText('generated.inline.0031_authenticated_8fda38ce')
        ? t('pages.create.common.authenticated')
        : t('pages.create.common.private');

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!title.trim() || !user?.id) return createBlockedSubmitOutcome();
    try {
      context?.reportProgress({ key: 'create', status: 'active' });
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
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });

      if (returnSection === 'todos' && groupId) {
        return createSuccessSubmitOutcome(
          createRouteSubmitTarget('todo', {
            to: '/group/$id/operation',
            params: { id: groupId },
            hash: returnSection,
          })
        );
      }

      return createSuccessSubmitOutcome(
        createRouteSubmitTarget('todo', {
          to: '/todos',
        })
      );
    } catch (error) {
      toast.error(t('pages.create.error.createFailed'));
      throw error;
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'todo',
      title: 'pages.create.todo.title',
      isSubmitting: isLoading,
      onSubmit: handleSubmit,
      submissionSteps: [
        { key: 'create', label: 'Erstellt Aufgabe' },
        { key: 'sync', label: 'Synchronisiert Zuweisung' },
        { key: 'ready', label: 'Bereitet Aufgabenliste vor' },
      ],
      steps: [
        {
          label: t('pages.create.todo.titleLabel'),
          isValid: () => !!title.trim(),
          fields: [
            {
              key: 'group',
              kind: 'typeahead',
              label: t('pages.create.common.group'),
              hint: t('pages.create.todo.groupHint'),
              props: {
                entityTypes: ['group'],
                value: groupId || undefined,
                onChange: item => {
                  handleGroupChange(item?.id ?? '', item?.label ?? '');
                },
                placeholder: t('pages.create.common.searchGroup'),
                filterFn: item => memberGroupIds.has(item.id),
              },
            },
            {
              key: 'title',
              kind: 'text',
              label: t('pages.create.todo.titleLabel'),
              required: true,
              hint: t('pages.create.todo.tips.title'),
              value: title,
              onValueChange: setTitle,
              placeholder: t('pages.create.todo.titlePlaceholder'),
            },
            {
              key: 'description',
              kind: 'text',
              multiline: true,
              label: t('pages.create.todo.descriptionLabel'),
              hint: t('pages.create.todo.tips.description'),
              value: description,
              onValueChange: setDescription,
              placeholder: t('pages.create.todo.descriptionPlaceholder'),
              rows: 4,
            },
          ],
        },
        {
          label: t('pages.create.todo.priorityLabel'),
          isValid: () => true,
          fields: [
            {
              key: 'priority',
              kind: 'customComponent',
              component: PriorityInput,
              props: { value: priority, onChange: setPriority },
            },
            {
              key: 'status',
              kind: 'customComponent',
              component: StatusInput,
              props: { value: status, onChange: setStatus },
            },
          ],
        },
        {
          label: t('pages.create.todo.assignTo'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'assignees',
              kind: 'customComponent',
              component: UserSearchInput,
              props: {
                value: assigneeIds,
                onChange: setAssigneeIds,
                label: t('pages.create.todo.assignToLabel'),
                placeholder: t('pages.create.todo.assignToPlaceholder'),
              },
            },
          ],
        },
        {
          label: t('pages.create.event.settings'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'due-date',
              kind: 'text',
              label: t('pages.create.todo.dueDateOptional'),
              value: dueDate,
              onValueChange: setDueDate,
              type: 'date',
            },
            {
              key: 'visibility',
              kind: 'customComponent',
              component: groupId ? CreateInlineNotice : VisibilityInput,
              props: groupId
                ? { children: t('pages.create.todo.groupVisibilityHint') }
                : { value: visibility, onChange: setVisibility },
            },
            {
              key: 'tags',
              kind: 'customComponent',
              component: HashtagEditor,
              props: {
                value: tags,
                onChange: setTags,
                label: t('pages.create.todo.tagsOptional'),
                placeholder: t('pages.create.todo.tagPlaceholder'),
                preferredSuggestions: preferredHashtagSuggestions,
              },
            },
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!title.trim(),
          fields: [
            {
              key: 'review',
              kind: 'customComponent',
              component: CreateSummaryStep,
              props: {
                entityType: 'todo',
                badge: t('pages.create.todo.reviewBadge'),
                title: title || t('pages.create.todo.titlePlaceholder'),
                subtitle: description || undefined,
                sections: [
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
                ],
              },
            },
          ],
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
      preferredHashtagSuggestions,
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
