import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { denyPublicApiMutation, requireOwner } from '../rbac/authorize';
import { isPermissionError } from '../rbac/errors';
import { zql } from '../schema';
import {
  createStripeCustomerSchema,
  updateStripeSubscriptionSchema,
  createStripePaymentSchema,
  createPaymentSchema,
  updatePaymentSchema,
  deletePaymentSchema,
} from './schema';

async function authorizeGroupPaymentManage(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  payment: {
    payer_group_id?: string | null;
    receiver_group_id?: string | null;
  }
) {
  const groupIds = [
    ...new Set([payment.payer_group_id, payment.receiver_group_id].filter(Boolean)),
  ];
  if (groupIds.length === 0) {
    return;
  }

  let lastError: unknown = null;

  for (const groupId of groupIds) {
    try {
      await can(tx, ctx, {
        action: 'manage',
        resource: 'groupPayments',
        groupId,
      });
      return;
    } catch (error) {
      if (!isPermissionError(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  // Reaching the loop end means every non-empty group endpoint failed with a
  // permission error, so the last iteration necessarily assigned lastError.
  throw lastError;
}

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const paymentSharedMutators = {
  // Create a stripe customer record
  createCustomer: defineMutator(createStripeCustomerSchema, async ({ tx, ctx, args }) => {
    requireOwner(tx, ctx, args.user_id, { action: 'create', resource: 'payments' });

    const now = Date.now();
    await tx.mutate.stripe_customer.insert({
      ...args,
      created_at: now,
      updated_at: now,
    });
  }),

  // Update subscription details
  updateSubscription: defineMutator(updateStripeSubscriptionSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const subscription = await tx.run(zql.stripe_subscription.where('id', args.id).one());
      const customer = subscription
        ? await tx.run(zql.stripe_customer.where('id', subscription.customer_id).one())
        : null;
      requireOwner(tx, ctx, customer?.user_id, { action: 'update', resource: 'payments' });
    }

    await tx.mutate.stripe_subscription.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  // Record a stripe payment
  // NOTE: server-only mutator — should be called from server context only
  recordPayment: defineMutator(createStripePaymentSchema, async ({ tx, args }) => {
    denyPublicApiMutation(tx, { action: 'create', resource: 'payments', scope: 'stripe-webhook' });

    const now = Date.now();
    await tx.mutate.stripe_payment.insert({
      ...args,
      created_at: now,
    });
  }),

  // Create a payment
  createPayment: defineMutator(createPaymentSchema, async ({ tx, ctx, args }) => {
    await authorizeGroupPaymentManage(tx, ctx, args);

    await tx.mutate.payment.insert({
      ...args,
      created_at: Date.now(),
    });
  }),

  // Update the editable scalar fields of a payment. Endpoints stay immutable here so
  // authorization is always evaluated against the payment's existing group scope.
  updatePayment: defineMutator(updatePaymentSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const payment = await tx.run(zql.payment.where('id', args.id).one());
      if (!payment) {
        throw new Error('Payment not found');
      }

      await authorizeGroupPaymentManage(tx, ctx, payment);
    }

    await tx.mutate.payment.update(args);
  }),

  // Delete a payment
  deletePayment: defineMutator(deletePaymentSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const payment = await tx.run(zql.payment.where('id', args.id).one());
      if (!payment) {
        throw new Error('Payment not found');
      }

      await authorizeGroupPaymentManage(tx, ctx, payment);
    }

    await tx.mutate.payment.delete({ id: args.id });
  }),
};
