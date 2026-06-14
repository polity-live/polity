import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { StatusBadge } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { PqlToolbar } from '@/features/pql/ui/PqlToolbar';
import {
  usePqlCollection,
  type PqlQuickFilterDefinition,
} from '@/features/pql/hooks/usePqlCollection';
import type { PqlFieldDefinition } from '@/features/pql/logic/applyPqlFilter';
import type { GroupPaymentRow } from '@/zero/groups/queries';
import type { ChartData, FinancialSummary } from '../types/group.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type PaymentFieldKey =
  | 'label'
  | 'type'
  | 'amount'
  | 'direction'
  | 'counterparty_keys'
  | 'created_at';

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  membership_fee: 'Membership fee',
  donation: 'Donation',
  subsidies: 'Subsidies',
  campaign: 'Campaign',
  material: 'Material',
  events: 'Events',
  others: 'Other',
};

function getPaymentTypeLabel(type: string | null | undefined): string {
  if (!type) {
    return 'Unknown type';
  }

  return PAYMENT_TYPE_LABELS[type] ?? type;
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
      getUserLabel(payment.payer_user) || getGroupLabel(payment.payer_group) || 'Unknown payer'
    );
  }

  return (
    getUserLabel(payment.receiver_user) ||
    getGroupLabel(payment.receiver_group) ||
    'Unknown receiver'
  );
}

function sortPayments(items: GroupPaymentRow[]): GroupPaymentRow[] {
  return [...items].sort(
    (leftPayment, rightPayment) => rightPayment.created_at - leftPayment.created_at
  );
}

interface PaymentsSectionProps {
  canManagePayments?: boolean;
  groupId: string;
  storageKey: string;
  payments: GroupPaymentRow[];
  summary: FinancialSummary;
  incomeData: ChartData[];
  expenditureData: ChartData[];
}

export function PaymentsSection({
  canManagePayments = true,
  groupId,
  storageKey,
  payments,
  summary,
  incomeData,
  expenditureData,
}: PaymentsSectionProps) {
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
        options: Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
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
    [counterpartyOptions, groupId]
  );

  const quickFilters = useMemo<readonly PqlQuickFilterDefinition<PaymentFieldKey>[]>(
    () => [
      { fieldKey: 'direction', label: translateText('generated.inline.0170_direction_fd8e45ba') },
      { fieldKey: 'type', label: translateText('generated.inline.0168_type_3deb7456') },
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
      ? 'text-green-600 dark:text-green-400'
      : summary.balance < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{translateText('generated.inline.0696_payments_44357ae5')}</CardTitle>
          {canManagePayments ? (
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link
                  to="/create/payment"
                  search={{
                    groupId,
                    direction: 'income',
                    returnSection: 'payments',
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {translateText('generated.inline.0697_add_income_12e52754')}
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link
                  to="/create/payment"
                  search={{
                    groupId,
                    direction: 'expense',
                    returnSection: 'payments',
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {translateText('generated.inline.0698_add_expense_f53d122b')}
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-muted-foreground text-sm">
              {translateText('generated.inline.0699_income_1c89b1f2')}
            </p>
            <p className="text-xl font-semibold text-green-600 dark:text-green-400">
              ${summary.income.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">
              {translateText('generated.inline.0700_expenditure_e2cfc2e3')}
            </p>
            <p className="text-xl font-semibold text-red-600 dark:text-red-400">
              ${summary.expenditure.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">
              {translateText('generated.inline.0701_balance_90eef613')}
            </p>
            <p className={`text-xl font-semibold ${balanceClass}`}>${summary.balance.toFixed(2)}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="text-muted-foreground mb-2 text-center text-sm font-medium">
              {translateText('generated.inline.0702_income_breakdown_cf3d2816')}
            </p>
            {incomeData.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {translateText('generated.inline.0703_no_income_recorded_04873bb9')}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={incomeData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                    {incomeData.map((entry, index) => (
                      <Cell key={`income-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div>
            <p className="text-muted-foreground mb-2 text-center text-sm font-medium">
              {translateText('generated.inline.0704_expenditure_breakdown_a520fca9')}
            </p>
            {expenditureData.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {translateText('generated.inline.0705_no_expenditure_recorded_e2eb7262')}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={expenditureData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                    {expenditureData.map((entry, index) => (
                      <Cell key={`expense-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {translateText('generated.inline.0706_transactions_1e3281a9')}
              </p>
              <p className="text-muted-foreground text-sm">
                {filteredItems.length}
                {translateText('generated.inline.0101_of_de04fa0e')}
                {payments.length}
                {translateText('generated.inline.0707_payments_shown_32ea2140')}
              </p>
            </div>
          </div>

          <PqlToolbar
            fields={fields}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchPlaceholder={translateText(
              'generated.inline.0708_search_payments_counterparties_or_types_b2fab485'
            )}
            quickFilters={quickFilters}
            quickFilterValues={quickFilterValues}
            onQuickFilterValuesChange={setQuickFilterValues}
            onQuickFilterToggle={toggleQuickFilterValue}
            onQuickFilterClear={clearQuickFilter}
            savedFilters={savedFilters}
            activeCustomFilterIds={activeCustomFilterIds}
            onCustomFilterToggle={toggleCustomFilter}
            onCustomFilterDelete={deleteCustomFilter}
            onCustomFilterSave={saveCustomFilter}
          />

          {filteredItems.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
              {hasActiveFilters
                ? translateText(
                    'generated.inline.0104_no_payments_match_the_current_search_and_filt_337a7d4e'
                  )
                : translateText('generated.inline.0105_no_payments_recorded_yet_15fc7dc7')}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredItems.map(payment => {
                const direction = getPaymentDirection(payment, groupId);
                const counterpartyLabel = getCounterpartyLabel(payment, groupId);
                const amountClass =
                  direction === 'income'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400';

                return (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {payment.label || getPaymentTypeLabel(payment.type)}
                        </span>
                        <StatusBadge
                          status={direction}
                          tone={direction === 'income' ? 'success' : 'warning'}
                        >
                          {direction === 'income'
                            ? translateText('generated.inline.0084_income_1c89b1f2')
                            : translateText('generated.inline.0085_expense_a0db8e68')}
                        </StatusBadge>
                        <StatusBadge status={payment.type} tone="outline">
                          {getPaymentTypeLabel(payment.type)}
                        </StatusBadge>
                      </div>
                      <p className="text-muted-foreground text-sm">{counterpartyLabel}</p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className={`text-lg font-semibold ${amountClass}`}>
                      {direction === 'income' ? '+' : '-'}${(payment.amount ?? 0).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
