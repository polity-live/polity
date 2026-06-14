import { FormControlLabel } from '@/features/shared/ui/form';
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useAllGroups, useGroupById } from '@/zero/groups/useGroupState';
import { usePaymentActions } from '@/zero/payments/usePaymentActions';
import { useUserState } from '@/zero/users/useUserState';
import { getUserDisplayName } from '@/features/search/utils/searchUtils';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import { Button } from '@/features/shared/ui/ui/button';
import { UserSearchInput } from '../ui/inputs/UserSearchInput';
import { DirectionInput } from '../ui/inputs/DirectionInput';
import { PaymentTypeInput } from '../ui/inputs/PaymentTypeInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import type { CreateFormConfig } from '../types/create-form.types';

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
  const { groups: allGroups } = useAllGroups();

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
  const [entityType, setEntityType] = useState<'user' | 'group'>('user');
  const [entityId, setEntityId] = useState('');
  const [entityGroupId, setEntityGroupId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setGroupId(groupIdParam ?? '');
  }, [groupIdParam]);

  useEffect(() => {
    if (directionParam) {
      setDirection(directionParam);
    }
  }, [directionParam]);

  const syncGroupSearch = (nextGroupId: string) => {
    navigate({
      to: '/create/payment',
      search: mergeCreateSearchParams(searchParams, {
        groupId: nextGroupId || undefined,
      }),
      replace: true,
    });
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const paymentId = crypto.randomUUID();
      const parsedAmount = parseFloat(amount);

      let payer_user_id: string | null = null;
      let payer_group_id: string | null = null;
      let receiver_user_id: string | null = null;
      let receiver_group_id: string | null = null;

      if (direction === 'income') {
        receiver_group_id = groupId || null;
        if (entityType === 'user') payer_user_id = entityId || null;
        else payer_group_id = entityGroupId || null;
      } else {
        payer_group_id = groupId || null;
        if (entityType === 'user') receiver_user_id = entityId || null;
        else receiver_group_id = entityGroupId || null;
      }

      await createPayment({
        id: paymentId,
        label,
        type,
        amount: parsedAmount,
        payer_user_id,
        payer_group_id,
        receiver_user_id,
        receiver_group_id,
      });
      toast.success(t('pages.create.success.created'));

      if (returnSection === 'payments' && groupId) {
        navigate({
          to: '/group/$id/operation',
          params: { id: groupId },
          hash: returnSection,
        });
        return;
      }

      navigate({ to: '/group/$id', params: { id: groupId } });
    } catch {
      toast.error(t('pages.create.error.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasEntity = entityType === 'user' ? !!entityId : !!entityGroupId;
  const groupDisplayName = group?.name ?? groupId;
  const selectedUser = allUsers.find(currentUser => currentUser.id === entityId);
  const selectedGroup = allGroups.find(currentGroup => currentGroup.id === entityGroupId);
  const selectedEntityDisplayName =
    entityType === 'user'
      ? getUserDisplayName(selectedUser) || entityId
      : selectedGroup?.name || entityGroupId;
  const directionLabel =
    direction === translateText('generated.inline.0039_income_0f613350')
      ? t('pages.create.payment.income')
      : t('pages.create.payment.expense');
  const counterpartLabel =
    direction === translateText('generated.inline.0039_income_0f613350')
      ? t('pages.create.payment.fromPayer')
      : t('pages.create.payment.toReceiver');
  const counterpartTypeLabel =
    entityType === translateText('generated.inline.0026_user_12dea96f')
      ? t('pages.create.payment.entityUser')
      : t('pages.create.payment.entityGroup');

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'payment',
      title: 'pages.create.payment.title',
      isSubmitting,
      onSubmit: handleSubmit,
      steps: [
        {
          label: t('pages.create.common.group'),
          isValid: () => !!groupId,
          fields: [
            {
              key: 'group',
              kind: 'typeahead',
              label: t('pages.create.common.group'),
              required: true,
              props: {
                entityTypes: ['group'],
                value: groupId || undefined,
                onChange: item => {
                  const nextGroupId = item?.id ?? '';
                  setGroupId(nextGroupId);
                  syncGroupSearch(nextGroupId);
                },
                placeholder: t('pages.create.common.searchGroup'),
              },
            },
          ],
        },
        {
          label: t('pages.create.payment.direction'),
          isValid: () => !!label.trim() && !!amount,
          fields: [
            {
              key: 'direction',
              kind: 'custom',
              node: <DirectionInput value={direction} onChange={setDirection} />,
            },
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
              kind: 'custom',
              node: <PaymentTypeInput value={type} onChange={setType} />,
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
            },
          ],
        },
        {
          label:
            direction === 'income'
              ? t('pages.create.payment.fromPayer')
              : t('pages.create.payment.toReceiver'),
          isValid: () => hasEntity,
          fields: [
            {
              key: 'entity-type',
              kind: 'custom',
              node: (
                <div className="space-y-4">
                  <FormControlLabel>
                    {direction === 'income'
                      ? t('pages.create.payment.fromPayer')
                      : t('pages.create.payment.toReceiver')}
                  </FormControlLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={entityType === 'user' ? 'default' : 'outline'}
                      onClick={() => {
                        setEntityType('user');
                        setEntityGroupId('');
                      }}
                      className="flex-1"
                    >
                      {t('pages.create.payment.entityUser')}
                    </Button>
                    <Button
                      type="button"
                      variant={entityType === 'group' ? 'default' : 'outline'}
                      onClick={() => {
                        setEntityType('group');
                        setEntityId('');
                      }}
                      className="flex-1"
                    >
                      {t('pages.create.payment.entityGroup')}
                    </Button>
                  </div>
                </div>
              ),
            },
            ...(entityType === 'user'
              ? [
                  {
                    key: 'entity-user',
                    kind: 'custom' as const,
                    node: (
                      <UserSearchInput
                        value={entityId ? [entityId] : []}
                        onChange={ids => setEntityId(ids[0] || '')}
                        required
                        placeholder={t('pages.create.payment.searchUsers')}
                        multi={false}
                      />
                    ),
                  },
                ]
              : [
                  {
                    key: 'entity-group',
                    kind: 'typeahead' as const,
                    label: t('pages.create.payment.entityGroup'),
                    required: true,
                    props: {
                      entityTypes: ['group' as const],
                      value: entityGroupId || undefined,
                      onChange: (item: { id: string } | null) => {
                        setEntityGroupId(item?.id ?? '');
                      },
                      placeholder: t('pages.create.payment.searchGroups'),
                    },
                  },
                ]),
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!groupId && !!label.trim() && !!amount && hasEntity,
          fields: [
            {
              key: 'review',
              kind: 'custom',
              node: (
                <CreateSummaryStep
                  entityType="payment"
                  badge={t('pages.create.payment.reviewBadge')}
                  secondaryBadge={directionLabel}
                  title={label || 'Untitled Payment'}
                  subtitle={`${parseFloat(amount || '0').toFixed(2)} €`}
                  sections={[
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
                          value: `${parseFloat(amount || '0').toFixed(2)} €`,
                        },
                      ],
                    },
                    {
                      title: counterpartLabel,
                      fields: [
                        {
                          label: t('pages.create.payment.entityGroup'),
                          value: counterpartTypeLabel,
                        },
                        {
                          label: counterpartLabel,
                          value: selectedEntityDisplayName || t('pages.create.common.notSelected'),
                        },
                      ],
                    },
                  ]}
                />
              ),
            },
          ],
        },
      ],
    }),
    [
      groupId,
      direction,
      label,
      type,
      amount,
      entityType,
      entityId,
      entityGroupId,
      isSubmitting,
      hasEntity,
      groupDisplayName,
      selectedEntityDisplayName,
      directionLabel,
      counterpartLabel,
      counterpartTypeLabel,
      syncGroupSearch,
      t,
    ]
  );

  return config;
}
