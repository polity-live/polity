import { featureThemeClassName } from '@/features/shared/theme';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { InlineNotice, SectionSkeleton } from '@/features/shared/ui/feedback';
import { SettingsPanel } from '@/features/shared/ui/form';
import { StatusBadge, type BadgeTone } from '@/features/shared/ui/status';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ConvertedCurrencyAmount } from '@/features/shared/ui/currency';
import { minorToMajor } from '@/features/shared/logic/currency';

export interface SubscriptionData {
  hasSubscription: boolean;
  subscription: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    interval: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  allSubscriptions: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    interval: string;
    createdAt: string;
    canceledAt: string | null;
  }[];
  payments: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    paidAt: string | null;
  }[];
}

interface SubscriptionStatusViewProps {
  data: SubscriptionData | null;
  isLoading: boolean;
  error: string | null;
}

const statusLabels: Record<string, string> = {
  active: translateText('generated.inline.0471_active_a733b809'),
  canceled: translateText('generated.inline.0472_canceled_f840ac65'),
  past_due: translateText('generated.inline.0473_past_due_7c15f3b7'),
  unpaid: translateText('generated.inline.0474_unpaid_50cc12f6'),
  incomplete: translateText('generated.inline.0475_incomplete_387fd1bb'),
  trialing: translateText('generated.inline.0476_trial_5f7537cf'),
};

function getStatusTone(status: string): BadgeTone {
  if (status === 'active') {
    return 'success';
  }

  if (status === 'trialing') {
    return 'info';
  }

  if (['canceled', 'past_due', 'unpaid'].includes(status)) {
    return 'destructive';
  }

  return 'outline';
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge status={status} tone={getStatusTone(status)}>
      {statusLabels[status] ?? status}
    </StatusBadge>
  );
}

function PaymentStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'paid':
      return (
        <CheckCircle2 className={featureThemeClassName('agendaAgendaElectionSectionSuccessIcon')} />
      );
    case 'failed':
      return <XCircle className={featureThemeClassName('paymentSubscriptionStatusDangerIcon')} />;
    default:
      return <Clock className={featureThemeClassName('agendaAgendaElectionSectionWarningIcon')} />;
  }
}

export function SubscriptionStatusView({ data, isLoading, error }: SubscriptionStatusViewProps) {
  if (isLoading) {
    return (
      <SettingsPanel title={translateText('generated.inline.1001_subscription_status_aa5794ad')}>
        <SectionSkeleton rows={2} />
      </SettingsPanel>
    );
  }

  if (error) {
    return (
      <SettingsPanel title={translateText('generated.inline.1001_subscription_status_aa5794ad')}>
        <InlineNotice variant="destructive">
          {translateText('generated.inline.1003_failed_to_load_subscription_data_86573459')}
        </InlineNotice>
      </SettingsPanel>
    );
  }

  if (!data) {
    return (
      <SettingsPanel
        title={translateText('generated.inline.1001_subscription_status_aa5794ad')}
        description={translateText(
          'generated.inline.1004_you_don_t_have_an_active_subscription_yet_e382e0f7'
        )}
      >
        <p className="text-muted-foreground text-sm">
          {translateText(
            'generated.inline.1005_subscribe_to_support_the_platform_and_get_acc_ec89484d'
          )}
        </p>
      </SettingsPanel>
    );
  }

  const activeSubscription = data.subscription;
  const subscriptions = data.allSubscriptions || [];
  const payments = (data.payments || []).slice(0, 10);

  return (
    <div className="space-y-6">
      <SettingsPanel
        title={translateText('generated.inline.1006_current_subscription_23045b61')}
        description={translateText(
          'generated.inline.1007_manage_your_subscription_and_billing_c805d8e9'
        )}
      >
        {activeSubscription ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">
                  <ConvertedCurrencyAmount
                    amount={minorToMajor(activeSubscription.amount, activeSubscription.currency)}
                    currency={activeSubscription.currency}
                  />
                  <span className="text-muted-foreground text-sm font-normal">
                    /{activeSubscription.interval}
                  </span>
                </p>
                <p className="text-muted-foreground text-sm">
                  {translateText('generated.inline.1008_next_billing_f789f53e')}{' '}
                  {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <SubscriptionStatusBadge status={activeSubscription.status} />
            </div>
            {activeSubscription.cancelAtPeriodEnd ? (
              <InlineNotice variant="warning">
                {translateText('generated.inline.1009_your_subscription_will_cancel_on_7b0839a4')}{' '}
                {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString()}
              </InlineNotice>
            ) : null}
          </div>
        ) : subscriptions.length > 0 ? (
          <div className="space-y-2">
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <span>
                {translateText(
                  'generated.inline.1010_you_previously_had_a_subscription_that_is_now_09847690'
                )}
              </span>
              <SubscriptionStatusBadge status={subscriptions[0].status} />
            </div>
            <p className="text-muted-foreground text-xs">
              {translateText('generated.inline.1011_last_active_dfc4865f')}
              {new Date(subscriptions[0].createdAt).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {translateText('generated.inline.1012_no_subscription_found_1654b473')}
          </p>
        )}
      </SettingsPanel>

      {payments.length > 0 ? (
        <SettingsPanel
          title={translateText('generated.inline.1013_payment_history_cfeba031')}
          description={translateText(
            'generated.inline.1014_your_recent_payments_and_invoices_a9bb5e16'
          )}
        >
          <div className="space-y-3">
            {payments.map((payment: any) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <PaymentStatusIcon status={payment.status} />
                  <div>
                    <p className="text-sm font-medium">
                      <ConvertedCurrencyAmount
                        amount={minorToMajor(payment.amount, payment.currency)}
                        currency={payment.currency}
                        date={(payment.paidAt ?? payment.createdAt).slice(0, 10)}
                      />
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {payment.paidAt
                        ? formatDistanceToNow(new Date(payment.paidAt), { addSuffix: true })
                        : new Date(payment.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <StatusBadge status={payment.status}>{payment.status}</StatusBadge>
              </div>
            ))}
          </div>
        </SettingsPanel>
      ) : null}

      {subscriptions.length > 1 ? (
        <SettingsPanel
          title={translateText('generated.inline.1015_subscription_history_89afcab4')}
          description={translateText(
            'generated.inline.1016_all_your_previous_subscriptions_66527c55'
          )}
        >
          <div className="space-y-3">
            {subscriptions.slice(1).map((subscription: any) => (
              <div
                key={subscription.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    <ConvertedCurrencyAmount
                      amount={minorToMajor(subscription.amount, subscription.currency)}
                      currency={subscription.currency}
                      date={subscription.createdAt.slice(0, 10)}
                    />
                    <span className="text-muted-foreground">/{subscription.interval}</span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(subscription.createdAt).toLocaleDateString()} -{' '}
                    {subscription.canceledAt
                      ? new Date(subscription.canceledAt).toLocaleDateString()
                      : translateText('generated.inline.0130_present_4e9f7a31')}
                  </p>
                </div>
                <SubscriptionStatusBadge status={subscription.status} />
              </div>
            ))}
          </div>
        </SettingsPanel>
      ) : null}
    </div>
  );
}
