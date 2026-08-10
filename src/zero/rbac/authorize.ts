import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '../schema';
import { PermissionError } from './errors';
import type { ActionType, ResourceType } from './types';

export interface AuthContext {
  readonly userID: string;
}

type AuthTx = Transaction<Schema>;

interface PermissionTarget {
  action?: ActionType;
  resource?: ResourceType;
  scope?: string;
}

const DEFAULT_TARGET: Required<Pick<PermissionTarget, 'action' | 'resource'>> = {
  action: 'manage',
  resource: '$users',
};

export function isClientTx(tx: AuthTx): boolean {
  return tx.location === 'client';
}

export function isAuthenticatedUser(ctx: AuthContext): boolean {
  return Boolean(ctx.userID && ctx.userID !== 'anon');
}

export function requireAuthenticated(
  tx: AuthTx,
  ctx: AuthContext,
  target: PermissionTarget = {}
): void {
  if (isClientTx(tx)) return;

  if (!isAuthenticatedUser(ctx)) {
    throw new PermissionError(
      target.action ?? DEFAULT_TARGET.action,
      target.resource ?? DEFAULT_TARGET.resource,
      target.scope ?? 'authentication required'
    );
  }
}

export function requireSelf(
  tx: AuthTx,
  ctx: AuthContext,
  targetUserId: string | null | undefined,
  target: PermissionTarget = {}
): void {
  if (isClientTx(tx)) return;

  requireAuthenticated(tx, ctx, target);

  if (!targetUserId || targetUserId !== ctx.userID) {
    throw new PermissionError(
      target.action ?? DEFAULT_TARGET.action,
      target.resource ?? DEFAULT_TARGET.resource,
      target.scope ?? `user:${targetUserId ?? 'unknown'}`
    );
  }
}

export function requireOwner(
  tx: AuthTx,
  ctx: AuthContext,
  ownerUserId: string | null | undefined,
  target: PermissionTarget
): void {
  requireSelf(tx, ctx, ownerUserId, target);
}

export function requireActorMatches(
  tx: AuthTx,
  ctx: AuthContext,
  actorUserId: string | null | undefined,
  target: PermissionTarget = {}
): void {
  requireSelf(tx, ctx, actorUserId, target);
}

export function denyPublicApiMutation(
  tx: AuthTx,
  target: Required<Pick<PermissionTarget, 'action' | 'resource'>> & Pick<PermissionTarget, 'scope'>
): void {
  if (isClientTx(tx)) return;
  throw new PermissionError(target.action, target.resource, target.scope ?? 'server-only');
}

export function canReadVisibility(
  visibility: string | null | undefined,
  ctx: AuthContext,
  hasPrivateAccess = false
): boolean {
  if (visibility === 'public') return true;
  if (visibility === 'authenticated') return isAuthenticatedUser(ctx);
  return isAuthenticatedUser(ctx) && hasPrivateAccess;
}
