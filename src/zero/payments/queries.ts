import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

export const paymentQueries = {
  // Payments for the current user (as payer)
  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.payment.where('payer_user_id', userID).orderBy('created_at', 'desc')
  ),

  // Subscription status for the current user
  subscriptionStatus: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.stripe_customer.where('user_id', userID).related('subscriptions').one()
  ),

  subscriptionStatusByUser: defineQuery(z.object({ userId: z.string() }), ({ args: { userId } }) =>
    zql.stripe_customer.where('user_id', userId).related('subscriptions').one()
  ),
};

export type PaymentByUserRow = QueryRowType<typeof paymentQueries.byUser>;
export type SubscriptionStatusRow = QueryRowType<typeof paymentQueries.subscriptionStatus>;
export type SubscriptionStatusByUserRow = QueryRowType<
  typeof paymentQueries.subscriptionStatusByUser
>;
