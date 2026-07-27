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
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { CurrencySelect } from '@/features/shared/ui/form/CurrencySelect';
import { formatCurrencyMajor, type CurrencyCode } from '@/features/shared/logic/currency';
import type { CurrencyConversionResult } from '@/features/shared/logic/currency';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';
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
function getCounterpartyLabel(payment: GroupPaymentRow, groupId: string): string {
  if (getPaymentDirection(payment, groupId) === 'income') {
    return (
      getUserLabel(payment.payer_user) ||
      getGroupLabel(payment.payer_group) ||
      translateText('features.groups.paymentDialog.unknownPayer')
    );
  }

  return (
    getUserLabel(payment.receiver_user) ||
    getGroupLabel(payment.receiver_group) ||
    translateText('features.groups.paymentDialog.unknownReceiver')
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
  targetCurrency: CurrencyCode;
  setTargetCurrency: (currency: CurrencyCode) => void;
  conversionState: {
    conversions: Record<string, CurrencyConversionResult>;
    missingPayments: any[];
    missingOriginalTotals: Record<string, number>;
    isLoading: boolean;
  };
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
  targetCurrency,
  setTargetCurrency,
  conversionState,
}: PaymentsSectionViewProps) {
  const { language, t } = useTranslation();
  const formatTarget = (amount: number) =>
    formatCurrencyMajor(amount, targetCurrency, language, {
      approximate: Object.values(conversionState.conversions).some(
        conversion => conversion.baseCurrency !== conversion.quoteCurrency
      ),
    });
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
        <div className="ml-auto max-w-sm space-y-1">
          <p className="text-muted-foreground text-xs">
            {t('pages.user.preferences.displayCurrency')}
          </p>
          <CurrencySelect value={targetCurrency} onChange={setTargetCurrency} />
        </div>
        {conversionState.isLoading ? (
          <p className="text-muted-foreground text-sm">
            {language === 'de' ? 'Wechselkurse werden geladen …' : 'Loading exchange rates…'}
          </p>
        ) : null}
        {conversionState.missingPayments.length > 0 ? (
          <div className="border-warning/40 bg-warning/10 rounded-md border px-3 py-2 text-sm">
            {t('pages.create.payment.conversionIncomplete', {
              count: conversionState.missingPayments.length,
            })}
            <span className="text-muted-foreground ml-2">
              {Object.entries(conversionState.missingOriginalTotals)
                .map(([currency, amount]) => formatCurrencyMajor(amount, currency, language))
                .join(' · ')}
            </span>
          </div>
        ) : null}
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-muted-foreground text-sm">
              {translateText('generated.inline.0699_income_1c89b1f2')}
            </p>
            <p className={featureThemeClassName('groupPaymentsSectionSuccessText')}>
              {formatTarget(summary.income)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">
              {translateText('generated.inline.0700_expenditure_e2cfc2e3')}
            </p>
            <p className={featureThemeClassName('groupPaymentsSectionDangerText')}>
              {formatTarget(summary.expenditure)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">
              {translateText('generated.inline.0701_balance_90eef613')}
            </p>
            <p className={`text-xl font-semibold ${balanceClass}`}>
              {formatTarget(summary.balance)}
            </p>
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
                    formatter={value => [
                      formatTarget(Number(value)),
                      t('pages.create.payment.amount'),
                    ]}
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
                    formatter={value => [
                      formatTarget(Number(value)),
                      t('pages.create.payment.amount'),
                    ]}
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
                const conversion = conversionState.conversions[payment.id];
                const originalCurrency = payment.currency || 'EUR';
                const originalAmount = formatCurrencyMajor(
                  payment.amount ?? 0,
                  originalCurrency,
                  language
                );
                const convertedAmount = conversion
                  ? formatCurrencyMajor(conversion.convertedAmount, targetCurrency, language, {
                      approximate: originalCurrency !== targetCurrency,
                    })
                  : originalAmount;

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

                    <div className={`text-right text-lg font-semibold ${amountClass}`}>
                      <div>
                        {direction === 'income' ? '+' : '-'}
                        {convertedAmount}
                      </div>
                      {conversion && originalCurrency !== targetCurrency ? (
                        <TooltipHint
                          content={`Frankfurter · ${conversion.rateDate} · 1 ${conversion.baseCurrency} = ${conversion.rate} ${conversion.quoteCurrency}`}
                        >
                          <div className="text-muted-foreground text-xs font-normal">
                            {originalAmount} ·{' '}
                            <a
                              href="https://frankfurter.dev/"
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              Frankfurter
                            </a>{' '}
                            {conversion.rateDate}
                            {conversion.cacheStatus === 'stale'
                              ? ` · ${language === 'de' ? 'veraltet' : 'stale'}`
                              : ''}
                          </div>
                        </TooltipHint>
                      ) : !conversion && !conversionState.isLoading ? (
                        <div className="text-warning text-xs font-normal">
                          {t('pages.create.payment.conversionUnavailable')}
                        </div>
                      ) : null}
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
