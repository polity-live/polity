'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card.tsx';
import { Badge } from '@/features/shared/ui/ui/badge.tsx';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import { stripeSubscriptionStatusFn } from '@/server/stripe-subscription-status';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface SubscriptionStatusProps {
  userId: string;
}

interface SubscriptionData {
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

export function SubscriptionStatus({ userId }: SubscriptionStatusProps) {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubscriptionStatus() {
      try {
        setIsLoading(true);

        const result = await stripeSubscriptionStatusFn({ data: { userId } });
        setData(result);
      } catch (err) {
        console.error('[SubscriptionStatus] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      fetchSubscriptionStatus();
    }
  }, [userId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {translateText('generated.inline.1001_subscription_status_aa5794ad')}
          </CardTitle>
          <CardDescription>
            {translateText('generated.inline.1002_loading_subscription_information_0dde4df6')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {translateText('generated.inline.1001_subscription_status_aa5794ad')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">
            {translateText('generated.inline.1003_failed_to_load_subscription_data_86573459')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {translateText('generated.inline.1001_subscription_status_aa5794ad')}
          </CardTitle>
          <CardDescription>
            {translateText(
              'generated.inline.1004_you_don_t_have_an_active_subscription_yet_e382e0f7'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {translateText(
              'generated.inline.1005_subscribe_to_support_the_platform_and_get_acc_ec89484d'
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeSubscription = data.subscription;
  const subscriptions = data.allSubscriptions || [];
  const payments = (data.payments || []).slice(0, 10); // Limit to last 10 payments

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      active: { label: translateText('generated.inline.0471_active_a733b809'), variant: 'default' },
      canceled: {
        label: translateText('generated.inline.0472_canceled_f840ac65'),
        variant: 'destructive',
      },
      past_due: {
        label: translateText('generated.inline.0473_past_due_7c15f3b7'),
        variant: 'destructive',
      },
      unpaid: {
        label: translateText('generated.inline.0474_unpaid_50cc12f6'),
        variant: 'destructive',
      },
      incomplete: {
        label: translateText('generated.inline.0475_incomplete_387fd1bb'),
        variant: 'outline',
      },
      trialing: {
        label: translateText('generated.inline.0476_trial_5f7537cf'),
        variant: 'secondary',
      },
    };

    const config = statusMap[status] || { label: status, variant: 'outline' };
    return (
      <Badge variant={config.variant} className={status === 'canceled' ? 'text-white' : undefined}>
        {config.label}
      </Badge>
    );
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              {translateText('generated.inline.1006_current_subscription_23045b61')}
            </CardTitle>
            <CardDescription>
              {translateText('generated.inline.1007_manage_your_subscription_and_billing_c805d8e9')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {activeSubscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {formatCurrency(activeSubscription.amount, activeSubscription.currency)}
                    <span className="text-muted-foreground text-sm font-normal">
                      /{activeSubscription.interval}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {translateText('generated.inline.1008_next_billing_f789f53e')}{' '}
                    {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                {getStatusBadge(activeSubscription.status)}
              </div>
              {activeSubscription.cancelAtPeriodEnd && (
                <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/20">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {translateText(
                      'generated.inline.1009_your_subscription_will_cancel_on_7b0839a4'
                    )}{' '}
                    {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          ) : subscriptions.length > 0 ? (
            <div className="space-y-2">
              <div className="text-muted-foreground text-sm">
                {translateText(
                  'generated.inline.1010_you_previously_had_a_subscription_that_is_now_09847690'
                )}{' '}
                {getStatusBadge(subscriptions[0].status)}
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
        </CardContent>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{translateText('generated.inline.1013_payment_history_cfeba031')}</CardTitle>
            <CardDescription>
              {translateText('generated.inline.1014_your_recent_payments_and_invoices_a9bb5e16')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map(payment => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {getPaymentStatusIcon(payment.status)}
                    <div>
                      <p className="text-sm font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {payment.paidAt
                          ? formatDistanceToNow(new Date(payment.paidAt), { addSuffix: true })
                          : new Date(payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={payment.status === 'paid' ? 'default' : 'destructive'}
                    className={
                      payment.status === 'paid'
                        ? 'text-emerald-foreground bg-emerald-500 hover:bg-emerald-600'
                        : undefined
                    }
                  >
                    {payment.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Subscriptions History */}
      {subscriptions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {translateText('generated.inline.1015_subscription_history_89afcab4')}
            </CardTitle>
            <CardDescription>
              {translateText('generated.inline.1016_all_your_previous_subscriptions_66527c55')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subscriptions.slice(1).map(subscription => (
                <div
                  key={subscription.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatCurrency(subscription.amount, subscription.currency)}
                      <span className="text-muted-foreground">/{subscription.interval}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(subscription.createdAt).toLocaleDateString()} -{' '}
                      {subscription.canceledAt
                        ? new Date(subscription.canceledAt).toLocaleDateString()
                        : translateText('generated.inline.0130_present_4e9f7a31')}
                    </p>
                  </div>
                  {getStatusBadge(subscription.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
