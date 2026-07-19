import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import {
  useAssignableGroupMembersByGroupIds,
  useGroupById,
  useGroupState,
} from '@/zero/groups/useGroupState';
import {
  useEventParticipantsByParticipatedEventIds,
  useUserEventParticipations,
} from '@/zero/events/useEventState';
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
import { TodoDeadlineInput } from '../ui/inputs/TodoDeadlineInput';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { UserSearchInput } from '../ui/inputs/UserSearchInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateInlineNotice } from '../ui/CreateInlineNotice';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import {
  collectUserIds,
  isActiveEventParticipantStatus,
  isActiveGroupMemberStatus,
  uniqueUserIds,
} from '../logic/eligibleUsers';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';
import { consumeCreateRestoreDraft, trackCreateFinalization } from '../logic/createFinalization';
import { toLocalDeadlineTimestamp } from '@/features/shared/logic/localDateTime';

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

  const activeMemberGroupIds = useMemo(
    () => [
      ...new Set(
        currentUserMembershipsWithGroups
          .filter(membership => isActiveGroupMemberStatus(membership.status))
          .map(membership => membership.group_id)
          .filter((currentGroupId): currentGroupId is string => Boolean(currentGroupId))
      ),
    ],
    [currentUserMembershipsWithGroups]
  );
  const memberGroupIds = useMemo(() => new Set(activeMemberGroupIds), [activeMemberGroupIds]);
  const eligibleGroupIds = useMemo(
    () => (groupId ? [groupId] : activeMemberGroupIds),
    [activeMemberGroupIds, groupId]
  );
  const { members: eligibleGroupMembers, isLoading: isEligibleGroupMembersLoading } =
    useAssignableGroupMembersByGroupIds(eligibleGroupIds);
  const { participations: userEventParticipations } = useUserEventParticipations(user?.id);
  const participatedEventIds = useMemo(
    () =>
      groupId
        ? []
        : [
            ...new Set(
              userEventParticipations
                .filter(participation => isActiveEventParticipantStatus(participation.status))
                .map(participation => participation.event_id)
                .filter((eventId): eventId is string => Boolean(eventId))
            ),
          ],
    [groupId, userEventParticipations]
  );
  const { participants: eligibleEventParticipants, isLoading: isEligibleEventParticipantsLoading } =
    useEventParticipantsByParticipatedEventIds(participatedEventIds);
  const allowedAssigneeUserIds = useMemo(
    () =>
      groupId
        ? collectUserIds(eligibleGroupMembers)
        : uniqueUserIds(
            collectUserIds(eligibleGroupMembers),
            collectUserIds(eligibleEventParticipants)
          ),
    [eligibleEventParticipants, eligibleGroupMembers, groupId]
  );
  const allowedAssigneeUserIdSet = useMemo(
    () => new Set(allowedAssigneeUserIds),
    [allowedAssigneeUserIds]
  );
  const isAssigneeEligibilityLoading =
    isEligibleGroupMembersLoading || (!groupId && isEligibleEventParticipantsLoading);
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
  const [dueTime, setDueTime] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'authenticated' | 'private'>('private');
  const [tags, setTags] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState('');

  useEffect(() => {
    setGroupId(groupIdParam);
  }, [groupIdParam]);

  useEffect(() => {
    const restoreDraft = consumeCreateRestoreDraft<{
      title?: string;
      description?: string;
      assigneeId?: string;
      priority?: 'low' | 'medium' | 'high';
      status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      dueDate?: string;
      dueTime?: string;
      tags?: string[];
      groupId?: string;
      visibility?: 'public' | 'authenticated' | 'private';
    }>('todo');
    if (!restoreDraft) return;

    setTitle(restoreDraft.formState.title ?? '');
    setDescription(restoreDraft.formState.description ?? '');
    setAssigneeId(restoreDraft.formState.assigneeId ?? '');
    setPriority(restoreDraft.formState.priority ?? 'medium');
    setStatus(restoreDraft.formState.status ?? 'pending');
    setDueDate(restoreDraft.formState.dueDate ?? '');
    setDueTime(restoreDraft.formState.dueTime ?? '');
    setTags(restoreDraft.formState.tags ?? []);
    setGroupId(restoreDraft.formState.groupId ?? '');
    setVisibility(restoreDraft.formState.visibility ?? 'private');
  }, []);

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

  useEffect(() => {
    if (assigneeId && !isAssigneeEligibilityLoading && !allowedAssigneeUserIdSet.has(assigneeId)) {
      setAssigneeId('');
    }
  }, [allowedAssigneeUserIdSet, assigneeId, isAssigneeEligibilityLoading]);

  const groupDisplayName = groupName || group?.name || groupId;
  const selectedAssignee = allUsers.find(currentUser => currentUser.id === assigneeId);
  const assigneeName = assigneeId ? getUserDisplayName(selectedAssignee) || assigneeId : '';
  const visibilityLabel = groupId
    ? t('pages.create.todo.groupVisibilityLabel')
    : visibility === translateText('generated.inline.0030_public_61c9b2b1')
      ? t('pages.create.common.public')
      : visibility === translateText('generated.inline.0031_authenticated_8fda38ce')
        ? t('pages.create.common.authenticated')
        : t('pages.create.common.private');
  const titleInvalidReason = !title.trim() ? t('pages.create.validation.titleRequired') : null;

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!title.trim() || !user?.id) return createBlockedSubmitOutcome();
    try {
      context?.reportProgress({ key: 'create', status: 'active' });
      const createResult = await createTodo(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          ownerId: user.id,
          assigneeId: assigneeId || user.id,
          priority,
          status,
          dueDate: toLocalDeadlineTimestamp(dueDate, dueTime) ?? undefined,
          tags,
          groupId: groupId || undefined,
          visibility: groupId ? 'group' : visibility,
        },
        { notificationMode: 'silent' }
      );
      if (!createResult.success || !createResult.todoId || !createResult.mutationResult) {
        throw createResult.error ?? new Error(t('pages.create.error.createFailed'));
      }

      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });

      const target =
        returnSection === 'todos' && groupId
          ? createRouteSubmitTarget('todo', {
              to: '/group/$id/operation',
              params: { id: groupId },
              hash: returnSection,
            })
          : createRouteSubmitTarget('todo', {
              to: '/todos/$id',
              params: { id: createResult.todoId },
            });

      trackCreateFinalization({
        result: createResult.mutationResult,
        draft: {
          id: `todo:${createResult.todoId}`,
          entityType: 'todo',
          entityId: createResult.todoId,
          createPath: '/create/todo',
          formState: {
            title,
            description,
            assigneeId,
            priority,
            status,
            dueDate,
            dueTime,
            tags,
            groupId,
            visibility,
          },
          mutationPayload: createResult.payload,
          target,
        },
      });

      if (returnSection === 'todos' && groupId) {
        return createSuccessSubmitOutcome(target);
      }

      return createSuccessSubmitOutcome(target);
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
        { key: 'create', label: t('pages.create.progress.submission.steps.todo.create') },
        { key: 'sync', label: t('pages.create.progress.submission.steps.todo.sync') },
        { key: 'ready', label: t('pages.create.progress.submission.steps.todo.ready') },
      ],
      steps: [
        {
          label: t('pages.create.todo.titleLabel'),
          isValid: () => !!title.trim(),
          getInvalidReason: () => titleInvalidReason,
          fields: [
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
          label: t('pages.create.todo.assignTo'),
          isValid: () => true,
          optional: true,
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
              key: 'assignee',
              kind: 'customComponent',
              component: UserSearchInput,
              props: {
                value: assigneeId ? [assigneeId] : [],
                onChange: (ids: string[]) => setAssigneeId(ids[0] ?? ''),
                label: t('pages.create.todo.assignToLabel'),
                placeholder: t('pages.create.todo.assignToPlaceholder'),
                allowedUserIds: allowedAssigneeUserIds,
                multi: false,
                showAllResults: true,
              },
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
          label: t('pages.create.event.settings'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'due-date-time',
              kind: 'customComponent',
              component: TodoDeadlineInput,
              props: {
                dueDate,
                dueTime,
                onChange: (values: { dueDate: string; dueTime: string }) => {
                  setDueDate(values.dueDate);
                  setDueTime(values.dueTime);
                },
              },
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
          getInvalidReason: () => titleInvalidReason,
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
                      {
                        label: t('pages.create.todo.priorityLabel'),
                        value: t(`pages.create.todo.priority.${priority}`),
                      },
                      {
                        label: t('pages.create.todo.statusLabel'),
                        value: t(`features.todos.status.${status}`),
                      },
                      ...(dueDate
                        ? [
                            {
                              label: t('pages.create.todo.dueDateLabel'),
                              value: `${dueDate}${dueTime ? ` ${dueTime}` : ''}`,
                            },
                          ]
                        : []),
                    ],
                  },
                  {
                    title: t('pages.create.todo.assignTo'),
                    fields: [
                      ...(groupId
                        ? [{ label: t('pages.create.common.group'), value: groupDisplayName }]
                        : []),
                      ...(assigneeName
                        ? [
                            {
                              label: t('pages.create.todo.assignedTo'),
                              value: assigneeName,
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
      assigneeId,
      dueDate,
      dueTime,
      visibility,
      visibilityLabel,
      titleInvalidReason,
      tags,
      preferredHashtagSuggestions,
      assigneeName,
      allowedAssigneeUserIds,
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
