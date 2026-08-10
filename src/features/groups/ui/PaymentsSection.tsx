import { featureThemeClassName } from '@/features/shared/theme';
import { useEffect, useMemo, useState } from 'react';
import {
  usePqlCollection,
  type PqlQuickFilterDefinition,
} from '@/features/pql/hooks/usePqlCollection';
import type { PqlFieldDefinition } from '@/features/pql/logic/applyPqlFilter';
import type { GroupPaymentRow } from '@/zero/groups/queries';
import type { ChartData, FinancialSummary } from '../types/group.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import { usePaymentConversions } from '../hooks/usePaymentConversions';
import { useFinancialData } from '../hooks/useFinancialData';
import type { CurrencyCode } from '@/features/shared/logic/currency';

type PaymentFieldKey =
  'label' | 'type' | 'amount' | 'currency' | 'direction' | 'counterparty_keys' | 'created_at';

const PAYMENT_TYPES = [
  'membership_fee',
  'donation',
  'subsidies',
  'campaign',
  'material',
  'events',
  'others',
] as const;

function getPaymentTypeLabel(type: string | null | undefined): string {
  const knownType = PAYMENT_TYPES.find(candidate => candidate === type);
  return translateText(`features.groups.paymentTypes.${knownType ?? 'unknown'}`);
}

function getPaymentDirection(payment: GroupPaymentRow, groupId: string): 'income' | 'expense' {
  return payment.receiver_group_id === groupId ? 'income' : 'expense';
}

function getUserLabel(
  user: GroupPaymentRow['payer_user'] | GroupPaymentRow['receiver_user']
): string | null {
  if (!user?.id) {
    return null;
  }

  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.handle ||
    user.email ||
    user.id
  );
}

function getGroupLabel(
  group: GroupPaymentRow['payer_group'] | GroupPaymentRow['receiver_group']
): string | null {
  if (!group?.id) {
    return null;
  }

  return group.name || group.id;
}

function getCounterpartyKey(payment: GroupPaymentRow, groupId: string): string | null {
  if (getPaymentDirection(payment, groupId) === 'income') {
    if (payment.payer_user?.id) {
      return `user:${payment.payer_user.id}`;
    }

    if (payment.payer_group?.id) {
      return `group:${payment.payer_group.id}`;
    }

    return null;
  }

  if (payment.receiver_user?.id) {
    return `user:${payment.receiver_user.id}`;
  }

  if (payment.receiver_group?.id) {
    return `group:${payment.receiver_group.id}`;
  }

  return null;
}

function getCounterpartyLabel(payment: GroupPaymentRow, groupId: string): string {
  if (getPaymentDirection(payment, groupId) === 'income') {
    return (
      getUserLabel(payment.payer_user) ||
      getGroupLabel(payment.payer_group) ||
      translateText('common.unknown')
    );
  }

  return (
    getUserLabel(payment.receiver_user) ||
    getGroupLabel(payment.receiver_group) ||
    translateText('common.unknown')
  );
}

function sortPayments(items: GroupPaymentRow[]): GroupPaymentRow[] {
  return [...items].sort(
    (leftPayment, rightPayment) => rightPayment.created_at - leftPayment.created_at
  );
}

export const paymentsSectionInternals = {
  getPaymentTypeLabel,
  getPaymentDirection,
  getUserLabel,
  getGroupLabel,
  getCounterpartyKey,
  getCounterpartyLabel,
  sortPayments,
};

interface PaymentsSectionProps {
  canManagePayments?: boolean;
  groupId: string;
  storageKey: string;
  payments: GroupPaymentRow[];
  summary: FinancialSummary;
  incomeData: ChartData[];
  expenditureData: ChartData[];
}
import { PaymentsSectionView } from './PaymentsSectionView';
export function PaymentsSection({
  canManagePayments = true,
  groupId,
  storageKey,
  payments,
  summary: _summary,
  incomeData: _incomeData,
  expenditureData: _expenditureData,
}: PaymentsSectionProps) {
  void _summary;
  void _incomeData;
  void _expenditureData;
  const { displayCurrency } = usePreferenceState();
  const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>(displayCurrency);
  useEffect(() => setTargetCurrency(displayCurrency), [displayCurrency]);
  const conversionState = usePaymentConversions(payments, targetCurrency);
  const { summary, incomeData, expenditureData } = useFinancialData(
    conversionState.convertiblePayments,
    groupId
  );
  const counterpartyOptions = useMemo(() => {
    const nextOptions = new Map<string, { value: string; label: string; keywords: string[] }>();

    for (const payment of payments) {
      const key = getCounterpartyKey(payment, groupId);
      if (!key) {
        continue;
      }

      const keywords = [
        payment.payer_user?.handle,
        payment.payer_user?.email,
        payment.receiver_user?.handle,
        payment.receiver_user?.email,
      ].filter((value): value is string => Boolean(value));

      nextOptions.set(key, {
        value: key,
        label: getCounterpartyLabel(payment, groupId),
        keywords,
      });
    }

    return [...nextOptions.values()].sort((leftOption, rightOption) =>
      leftOption.label.localeCompare(rightOption.label)
    );
  }, [groupId, payments]);

  const fields = useMemo<readonly PqlFieldDefinition<GroupPaymentRow, PaymentFieldKey>[]>(
    () => [
      {
        key: 'label',
        label: translateText('generated.inline.0167_label_74341e3c'),
        kind: 'text',
        operators: ['contains', 'eq'],
        getValue: payment => payment.label,
      },
      {
        key: 'type',
        label: translateText('generated.inline.0168_type_3deb7456'),
        kind: 'enum',
        operators: ['eq', 'in'],
        options: PAYMENT_TYPES.map(value => ({ value, label: getPaymentTypeLabel(value) })),
        getValue: payment => payment.type,
      },
      {
        key: 'amount',
        label: translateText('generated.inline.0169_amount_43dc8532'),
        kind: 'number',
        operators: ['eq', 'gt', 'gte', 'lt', 'lte'],
        getValue: payment => payment.amount,
      },
      {
        key: 'currency',
        label: translateText('pages.create.payment.currency'),
        kind: 'enum',
        operators: ['eq', 'in'],
        options: Array.from(new Set(payments.map(payment => payment.currency || 'EUR'))).map(
          currency => ({ value: currency, label: currency })
        ),
        getValue: payment => payment.currency || 'EUR',
      },
      {
        key: 'direction',
        label: translateText('generated.inline.0170_direction_fd8e45ba'),
        kind: 'enum',
        operators: ['eq', 'in'],
        options: [
          { value: 'income', label: translateText('generated.inline.0171_income_1c89b1f2') },
          { value: 'expense', label: translateText('generated.inline.0172_expense_a0db8e68') },
        ],
        getValue: payment => getPaymentDirection(payment, groupId),
      },
      {
        key: 'counterparty_keys',
        label: translateText('generated.inline.0173_counterparty_97b2be49'),
        kind: 'entity',
        operators: ['in'],
        options: counterpartyOptions,
        getValue: payment => {
          const key = getCounterpartyKey(payment, groupId);
          return key ? [key] : [];
        },
      },
      {
        key: 'created_at',
        label: translateText('generated.inline.0089_created_accf40c8'),
        kind: 'date',
        operators: ['gt', 'gte', 'lt', 'lte'],
        getValue: payment => payment.created_at,
      },
    ],
    [counterpartyOptions, groupId, payments]
  );

  const quickFilters = useMemo<readonly PqlQuickFilterDefinition<PaymentFieldKey>[]>(
    () => [
      { fieldKey: 'direction', label: translateText('generated.inline.0170_direction_fd8e45ba') },
      { fieldKey: 'type', label: translateText('generated.inline.0168_type_3deb7456') },
      { fieldKey: 'currency', label: translateText('pages.create.payment.currency') },
    ],
    []
  );

  const {
    searchQuery,
    setSearchQuery,
    quickFilterValues,
    setQuickFilterValues,
    toggleQuickFilterValue,
    clearQuickFilter,
    savedFilters,
    saveCustomFilter,
    deleteCustomFilter,
    activeCustomFilterIds,
    toggleCustomFilter,
    filteredItems,
    hasActiveFilters,
  } = usePqlCollection({
    items: payments,
    fields,
    quickFilters,
    storageKey,
    groupId,
    searchValues: [
      payment =>
        [
          payment.label,
          getPaymentTypeLabel(payment.type),
          getCounterpartyLabel(payment, groupId),
        ].filter((value): value is string => Boolean(value)),
    ],
    sortItems: sortPayments,
  });

  const balanceClass =
    summary.balance > 0
      ? featureThemeClassName('decisionterminalDecisionStatusSuccessText')
      : summary.balance < 0
        ? featureThemeClassName('decisionterminalDecisionStatusDangerTextAlpha')
        : 'text-muted-foreground';
  return (
    <PaymentsSectionView
      canManagePayments={canManagePayments}
      groupId={groupId}
      storageKey={storageKey}
      payments={payments}
      summary={summary}
      incomeData={incomeData}
      expenditureData={expenditureData}
      counterpartyOptions={counterpartyOptions}
      fields={fields}
      quickFilters={quickFilters}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      quickFilterValues={quickFilterValues}
      setQuickFilterValues={setQuickFilterValues}
      toggleQuickFilterValue={toggleQuickFilterValue}
      clearQuickFilter={clearQuickFilter}
      savedFilters={savedFilters}
      saveCustomFilter={saveCustomFilter}
      deleteCustomFilter={deleteCustomFilter}
      activeCustomFilterIds={activeCustomFilterIds}
      toggleCustomFilter={toggleCustomFilter}
      filteredItems={filteredItems}
      hasActiveFilters={hasActiveFilters}
      balanceClass={balanceClass}
      targetCurrency={targetCurrency}
      setTargetCurrency={setTargetCurrency}
      conversionState={conversionState}
    />
  );
}
