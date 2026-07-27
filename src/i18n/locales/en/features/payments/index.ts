export const paymentsTranslations = {
  title: 'Payments',
  subscriptions: {
    types: {
      user: 'User',
      group: 'Group',
      amendment: 'Amendment',
      event: 'Event',
      blog: 'Blog',
      unknown: 'Unknown',
    },
    unknown: {
      user: 'Unknown User',
      group: 'Unknown Group',
      amendment: 'Unknown Amendment',
      event: 'Unknown Event',
      blog: 'Unknown Blog',
      entity: 'Unknown Entity',
    },
    notAvailable: 'N/A',
  },
  billing: {
    title: 'Billing',
    description: 'Manage invoices, payment methods, and cancellations securely with Stripe.',
    manage: 'Manage payments',
    synced: 'Billing data has been updated.',
    portalError: 'The customer portal could not be opened.',
  },
  plans: {
    activeUntil: 'Active until {{date}}',
    thenFree: 'You will automatically switch to Free after that.',
    nextPlan: 'Next plan',
    freeFrom: 'Free from {{date}}',
    changeScheduled: 'Change scheduled',
    period: '/month',
    exchangeRateNotice:
      'Checkout is charged in EUR. Converted values are estimates using Frankfurter rates.',
    cancellationScheduled:
      'Your switch to Free at the end of the billing period has been scheduled.',
  },
} as const;
