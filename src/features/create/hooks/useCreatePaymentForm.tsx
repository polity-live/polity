import { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import {
  useAssignableGroupMembersByGroupIds,
  useCurrentUserActiveGroups,
  useGroupById,
} from '@/zero/groups/useGroupState';
import { usePaymentActions } from '@/zero/payments/usePaymentActions';
import { useUserState } from '@/zero/users/useUserState';
import { getUserDisplayName } from '@/features/search/utils/searchUtils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import { UserSearchInput } from '../ui/inputs/UserSearchInput';
import { DirectionInput } from '../ui/inputs/DirectionInput';
import { PaymentTypeInput } from '../ui/inputs/PaymentTypeInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import { parseCreatePaymentAmount } from '../logic/paymentAmount';
import { collectUserIds } from '../logic/eligibleUsers';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';
import {
  consumeCreateRestoreDraft,
  trackCreateFinalization,
  waitForOptimisticCreate,
} from '../logic/createFinalization';

interface CreatePaymentSearch {
  groupId?: string;
  direction?: 'income' | 'expense';
  returnSection?: 'payments';
}

export function useCreatePaymentForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as CreatePaymentSearch;
  const { user } = useAuth();
  const { createPayment } = usePaymentActions();
  const { allUsers } = useUserState({ includeAllUsers: true });
  const { groups: activeGroups, isLoading: isActiveGroupsLoading } = useCurrentUserActiveGroups();
  const activeGroupItems = useMemo(
    () =>
      activeGroups.map(group => ({
        id: group.id,
        entityType: 'group' as const,
        label: group.name,
      })),
    [activeGroups]
  );
  const activeGroupIds = useMemo(
    () => new Set(activeGroups.map(group => group.id)),
    [activeGroups]
  );

  const groupIdParam = searchParams.groupId;
  const directionParam = searchParams.direction;
  const returnSection = searchParams.returnSection;
  const [groupId, setGroupId] = useState('');
  const { group } = useGroupById(groupId || undefined);
  const [direction, setDirection] = useState<'income' | 'expense'>('income');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<
    'membership_fee' | 'donation' | 'subsidies' | 'campaign' | 'material' | 'events' | 'others'
  >('donation');
  const [amount, setAmount] = useState('');
  const [entityId, setEntityId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { members: assignableGroupMembers, isLoading: isAssignableGroupMembersLoading } =
    useAssignableGroupMembersByGroupIds(groupId ? [groupId] : []);
  const allowedCounterpartyUserIds = useMemo(
    () => collectUserIds(assignableGroupMembers),
    [assignableGroupMembers]
  );
  const allowedCounterpartyUserIdSet = useMemo(
    () => new Set(allowedCounterpartyUserIds),
    [allowedCounterpartyUserIds]
  );

  useEffect(() => {
    setGroupId(groupIdParam ?? '');
    setEntityId('');
  }, [groupIdParam]);

  useEffect(() => {
    if (directionParam) {
      setDirection(directionParam);
    }
  }, [directionParam]);

  useEffect(() => {
    const restoreDraft = consumeCreateRestoreDraft<{
      groupId?: string;
      direction?: 'income' | 'expense';
      label?: string;
      type?:
        | 'membership_fee'
        | 'donation'
        | 'subsidies'
        | 'campaign'
        | 'material'
        | 'events'
        | 'others';
      amount?: string;
      entityId?: string;
    }>('payment');
    if (!restoreDraft) return;

    setGroupId(restoreDraft.formState.groupId ?? '');
    setDirection(restoreDraft.formState.direction ?? 'income');
    setLabel(restoreDraft.formState.label ?? '');
    setType(restoreDraft.formState.type ?? 'donation');
    setAmount(restoreDraft.formState.amount ?? '');
    setEntityId(restoreDraft.formState.entityId ?? '');
  }, []);

  const syncGroupSearch = useCallback(
    (nextGroupId: string) => {
      navigate({
        to: '/create/payment',
        search: mergeCreateSearchParams(searchParams, {
          groupId: nextGroupId || undefined,
        }),
        replace: true,
      });
    },
    [navigate, searchParams]
  );

  const handleGroupChange = useCallback(
    (nextGroupId: string) => {
      setGroupId(nextGroupId);
      setEntityId('');
      syncGroupSearch(nextGroupId);
    },
    [syncGroupSearch]
  );

  useEffect(() => {
    if (
      entityId &&
      !isAssignableGroupMembersLoading &&
      !allowedCounterpartyUserIdSet.has(entityId)
    ) {
      setEntityId('');
    }
  }, [allowedCounterpartyUserIdSet, entityId, isAssignableGroupMembersLoading]);

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!user) return createBlockedSubmitOutcome();
    if (!label.trim()) return createBlockedSubmitOutcome();
    if (!activeGroupIds.has(groupId) || !entityId) return createBlockedSubmitOutcome();
    const parsedAmount = parseCreatePaymentAmount(amount);
    if (parsedAmount == null) return createBlockedSubmitOutcome();

    setIsSubmitting(true);
    try {
      context?.reportProgress({ key: 'create', status: 'active' });
      const paymentId = crypto.randomUUID();

      let payer_user_id: string | null = null;
      let payer_group_id: string | null = null;
      let receiver_user_id: string | null = null;
      let receiver_group_id: string | null = null;

      if (direction === 'income') {
        payer_user_id = entityId;
        receiver_group_id = groupId;
      } else {
        payer_group_id = groupId;
        receiver_user_id = entityId;
      }

      const paymentPayload = {
        id: paymentId,
        label: label.trim(),
        type,
        amount: parsedAmount,
        payer_user_id,
        payer_group_id,
        receiver_user_id,
        receiver_group_id,
      };
      const paymentResult = createPayment(paymentPayload);
      await waitForOptimisticCreate(paymentResult);
      toast.success(t('pages.create.success.created'));
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });

      const paymentTarget = createRouteSubmitTarget('payment', {
        to: '/group/$id/operation',
        params: { id: groupId },
        hash: returnSection ?? 'payments',
      });
      context?.setRecoveryTarget(paymentTarget);
      trackCreateFinalization({
        result: paymentResult,
        draft: {
          id: `payment:${paymentId}`,
          entityType: 'payment',
          entityId: paymentId,
          createPath: '/create/payment',
          formState: {
            groupId,
            direction,
            label,
            type,
            amount,
            entityId,
            returnSection,
          },
          mutationPayload: paymentPayload,
          target: paymentTarget,
        },
        retry: () => {
          const retryResult = createPayment(paymentPayload);
          trackCreateFinalization({
            result: retryResult,
            draft: {
              id: `payment:${paymentId}`,
              entityType: 'payment',
              entityId: paymentId,
              createPath: '/create/payment',
              formState: {
                groupId,
                direction,
                label,
                type,
                amount,
                entityId,
                returnSection,
              },
              mutationPayload: paymentPayload,
              target: paymentTarget,
            },
          });
        },
      });

      return createSuccessSubmitOutcome(paymentTarget);
    } catch (error) {
      toast.error(t('pages.create.error.createFailed'));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasEntity = !!entityId;
  const hasActiveGroup = activeGroupIds.has(groupId);
  const parsedAmount = parseCreatePaymentAmount(amount);
  const hasValidAmount = parsedAmount != null;
  const detailsInvalidReason = !label.trim()
    ? t('pages.create.payment.validation.labelRequired')
    : !amount.trim()
      ? t('pages.create.payment.validation.amountRequired')
      : !hasValidAmount
        ? t('pages.create.payment.validation.amountInvalid')
        : null;
  const counterpartInvalidReason = !hasActiveGroup
    ? t('pages.create.payment.validation.groupRequired')
    : !hasEntity
      ? t('pages.create.payment.validation.counterpartyRequired')
      : null;
  const paymentInvalidReason = detailsInvalidReason ?? counterpartInvalidReason;
  const formattedAmount = `${(parsedAmount ?? 0).toFixed(2)} €`;
  const groupDisplayName = group?.name ?? groupId;
  const selectedUser = allUsers.find(currentUser => currentUser.id === entityId);
  const selectedEntityDisplayName = getUserDisplayName(selectedUser) || entityId;
  const directionLabel =
    direction === 'income' ? t('pages.create.payment.income') : t('pages.create.payment.expense');
  const counterpartLabel =
    direction === 'income'
      ? t('pages.create.payment.fromPayer')
      : t('pages.create.payment.toReceiver');

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'payment',
      title: 'pages.create.payment.title',
      isSubmitting,
      onSubmit: handleSubmit,
      submissionSteps: [
        { key: 'create', label: t('pages.create.progress.submission.steps.payment.create') },
        { key: 'sync', label: t('pages.create.progress.submission.steps.payment.sync') },
        { key: 'ready', label: t('pages.create.progress.submission.steps.payment.ready') },
      ],
      steps: [
        {
          label: t('pages.create.payment.direction'),
          isValid: () => !!label.trim() && hasValidAmount,
          getInvalidReason: () => detailsInvalidReason,
          fields: [
            {
              key: 'label',
              kind: 'text',
              label: t('pages.create.payment.labelField'),
              required: true,
              hint: t('pages.create.payment.tips.label'),
              value: label,
              onValueChange: setLabel,
              placeholder: t('pages.create.payment.labelPlaceholder'),
            },
            {
              key: 'type',
              kind: 'customComponent',
              component: PaymentTypeInput,
              props: { value: type, onChange: setType },
            },
            {
              key: 'amount',
              kind: 'text',
              label: t('pages.create.payment.amount'),
              required: true,
              hint: t('pages.create.payment.tips.amount'),
              type: 'number',
              min: '0',
              placeholder: '0.00',
              value: amount,
              onValueChange: setAmount,
              validator: value =>
                parseCreatePaymentAmount(value) == null
                  ? t('pages.create.payment.validation.amountInvalid')
                  : null,
            },
            {
              key: 'direction',
              kind: 'customComponent',
              component: DirectionInput,
              props: { value: direction, onChange: setDirection },
            },
          ],
        },
        {
          label: counterpartLabel,
          isValid: () => hasActiveGroup && hasEntity,
          getInvalidReason: () => counterpartInvalidReason,
          fields: [
            {
              key: 'group',
              kind: 'typeahead',
              label: t('pages.create.common.group'),
              required: true,
              props: {
                items: activeGroupItems,
                value: groupId || undefined,
                onChange: item => {
                  handleGroupChange(item?.id ?? '');
                },
                placeholder: t('pages.create.common.searchGroup'),
                disabled: isActiveGroupsLoading,
              },
            },
            {
              key: 'entity-user',
              kind: 'customComponent',
              component: UserSearchInput,
              props: {
                value: entityId ? [entityId] : [],
                onChange: (ids: string[]) => setEntityId(ids[0] || ''),
                label:
                  direction === 'income'
                    ? t('pages.create.payment.fromPayer')
                    : t('pages.create.payment.toReceiver'),
                required: true,
                placeholder: t('pages.create.payment.searchUsers'),
                allowedUserIds: allowedCounterpartyUserIds,
                disabled: !groupId,
                multi: false,
                showAllResults: true,
              },
            },
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => hasActiveGroup && !!label.trim() && hasValidAmount && hasEntity,
          getInvalidReason: () => paymentInvalidReason,
          fields: [
            {
              key: 'review',
              kind: 'customComponent',
              component: CreateSummaryStep,
              props: {
                entityType: 'payment',
                badge: t('pages.create.payment.reviewBadge'),
                secondaryBadge: directionLabel,
                title: label || t('pages.create.payment.untitled'),
                subtitle: formattedAmount,
                sections: [
                  {
                    title: t('pages.create.payment.direction'),
                    fields: [
                      ...(groupDisplayName
                        ? [{ label: t('pages.create.common.group'), value: groupDisplayName }]
                        : []),
                      {
                        label: t('pages.create.payment.direction'),
                        value: directionLabel,
                      },
                      {
                        label: t('pages.create.payment.typeField'),
                        value: t(`pages.create.payment.types.${type}`),
                      },
                      {
                        label: t('pages.create.payment.amount'),
                        value: formattedAmount,
                      },
                    ],
                  },
                  {
                    title: counterpartLabel,
                    fields: [
                      {
                        label: counterpartLabel,
                        value: selectedEntityDisplayName || t('pages.create.common.notSelected'),
                      },
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
      groupId,
      activeGroupIds,
      activeGroupItems,
      isActiveGroupsLoading,
      hasActiveGroup,
      direction,
      label,
      type,
      amount,
      hasValidAmount,
      detailsInvalidReason,
      counterpartInvalidReason,
      paymentInvalidReason,
      formattedAmount,
      entityId,
      isSubmitting,
      hasEntity,
      groupDisplayName,
      selectedEntityDisplayName,
      directionLabel,
      counterpartLabel,
      allowedCounterpartyUserIds,
      handleGroupChange,
      t,
    ]
  );

  return config;
}
