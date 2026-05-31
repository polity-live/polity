import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import { PqlToolbar } from '@/features/pql/ui/PqlToolbar';
import {
  usePqlCollection,
  type PqlQuickFilterDefinition,
} from '@/features/pql/hooks/usePqlCollection';
import type { PqlFieldDefinition } from '@/features/pql/logic/applyPqlFilter';
import type { GroupPaymentRow } from '@/zero/groups/queries';
import type { ChartData, FinancialSummary } from '../types/group.types';

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
        label: 'Label',
        kind: 'text',
        operators: ['contains', 'eq'],
        getValue: payment => payment.label,
      },
      {
        key: 'type',
        label: 'Type',
        kind: 'enum',
        operators: ['eq', 'in'],
        options: Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        getValue: payment => payment.type,
      },
      {
        key: 'amount',
        label: 'Amount',
        kind: 'number',
        operators: ['eq', 'gt', 'gte', 'lt', 'lte'],
        getValue: payment => payment.amount,
      },
      {
        key: 'direction',
        label: 'Direction',
        kind: 'enum',
        operators: ['eq', 'in'],
        options: [
          { value: 'income', label: 'Income' },
          { value: 'expense', label: 'Expense' },
        ],
        getValue: payment => getPaymentDirection(payment, groupId),
      },
      {
        key: 'counterparty_keys',
        label: 'Counterparty',
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
        label: 'Created',
        kind: 'date',
        operators: ['gt', 'gte', 'lt', 'lte'],
        getValue: payment => payment.created_at,
      },
    ],
    [counterpartyOptions, groupId]
  );

  const quickFilters = useMemo<readonly PqlQuickFilterDefinition<PaymentFieldKey>[]>(
    () => [
      { fieldKey: 'direction', label: 'Direction' },
      { fieldKey: 'type', label: 'Type' },
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
          <CardTitle>Payments</CardTitle>
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
                  Add Income
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
                  Add Expense
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
            <p className="text-muted-foreground text-sm">Income</p>
            <p className="text-xl font-semibold text-green-600 dark:text-green-400">
              ${summary.income.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Expenditure</p>
            <p className="text-xl font-semibold text-red-600 dark:text-red-400">
              ${summary.expenditure.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Balance</p>
            <p className={`text-xl font-semibold ${balanceClass}`}>${summary.balance.toFixed(2)}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="text-muted-foreground mb-2 text-center text-sm font-medium">
              Income Breakdown
            </p>
            {incomeData.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">No income recorded</p>
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
              Expenditure Breakdown
            </p>
            {expenditureData.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No expenditure recorded
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
              <p className="text-sm font-medium">Transactions</p>
              <p className="text-muted-foreground text-sm">
                {filteredItems.length} of {payments.length} payments shown
              </p>
            </div>
          </div>

          <PqlToolbar
            fields={fields}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchPlaceholder="Search payments, counterparties, or types..."
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
                ? 'No payments match the current search and filters.'
                : 'No payments recorded yet.'}
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
                        <Badge variant={direction === 'income' ? 'default' : 'secondary'}>
                          {direction === 'income' ? 'Income' : 'Expense'}
                        </Badge>
                        <Badge variant="outline">{getPaymentTypeLabel(payment.type)}</Badge>
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
