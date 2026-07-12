import { featureThemeClassName } from '@/features/shared/theme';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from '@/features/shared/ui/charting';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { StatusBadge } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { PqlToolbar } from '@/features/pql/ui/PqlToolbar';
import type { GroupPaymentRow } from '@/zero/groups/queries';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
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
export interface PaymentsSectionViewProps {
  canManagePayments: any;
  groupId: any;
  storageKey: any;
  payments: any;
  summary: any;
  incomeData: any;
  expenditureData: any;
  counterpartyOptions: any;
  fields: any;
  quickFilters: any;
  searchQuery: any;
  setSearchQuery: any;
  quickFilterValues: any;
  setQuickFilterValues: any;
  toggleQuickFilterValue: any;
  clearQuickFilter: any;
  savedFilters: any;
  saveCustomFilter: any;
  deleteCustomFilter: any;
  activeCustomFilterIds: any;
  toggleCustomFilter: any;
  filteredItems: any;
  hasActiveFilters: any;
  balanceClass: any;
}

export function PaymentsSectionView({
  canManagePayments,
  groupId,
  payments,
  summary,
  incomeData,
  expenditureData,
  fields,
  quickFilters,
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
  balanceClass,
}: PaymentsSectionViewProps) {
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
            <p className={featureThemeClassName('groupPaymentsSectionSuccessText')}>
              ${summary.income.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">
              {translateText('generated.inline.0700_expenditure_e2cfc2e3')}
            </p>
            <p className={featureThemeClassName('groupPaymentsSectionDangerText')}>
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
                    {incomeData.map((entry: any, index: number) => (
                      <Cell key={`income-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={value => [`$${Number(value).toFixed(2)}`, 'Amount']}
                  />
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
                    {expenditureData.map((entry: any, index: number) => (
                      <Cell key={`expense-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={value => [`$${Number(value).toFixed(2)}`, 'Amount']}
                  />
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
              {filteredItems.map((payment: any) => {
                const direction = getPaymentDirection(payment, groupId);
                const counterpartyLabel = getCounterpartyLabel(payment, groupId);
                const amountClass =
                  direction === 'income'
                    ? featureThemeClassName('decisionterminalDecisionStatusSuccessText')
                    : featureThemeClassName('decisionterminalDecisionStatusDangerTextAlpha');

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
