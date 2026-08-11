import { describe, expect, it, vi } from 'vitest';
import {
  canReadVisibility,
  denyPublicApiMutation,
  isAuthenticatedUser,
  isClientTx,
  requireActorMatches,
  requireAuthenticated,
  requireOwner,
  requireSelf,
} from '../authorize';
import { PermissionError } from '../errors';

const clientTx = { location: 'client' } as any;
const serverTx = { location: 'server' } as any;

describe('server authorization helpers', () => {
  it('classifies transaction location and authenticated identities', () => {
    expect(isClientTx(clientTx)).toBe(true);
    expect(isClientTx(serverTx)).toBe(false);
    expect(isAuthenticatedUser({ userID: '' })).toBe(false);
    expect(isAuthenticatedUser({ userID: 'anon' })).toBe(false);
    expect(isAuthenticatedUser({ userID: 'user-a' })).toBe(true);
  });

  it('keeps client-location mutators optimistic', () => {
    expect(() =>
      requireAuthenticated(clientTx, { userID: 'anon' }, { action: 'create', resource: 'groups' })
    ).not.toThrow();

    expect(() =>
      requireOwner(clientTx, { userID: 'anon' }, 'other-user', {
        action: 'update',
        resource: '$users',
      })
    ).not.toThrow();

    expect(() =>
      denyPublicApiMutation(clientTx, { action: 'create', resource: 'notifications' })
    ).not.toThrow();
  });

  it('rejects unauthenticated and non-owner server mutations', () => {
    expect(() =>
      requireAuthenticated(serverTx, { userID: 'anon' }, { action: 'create', resource: 'groups' })
    ).toThrow(PermissionError);

    expect(() =>
      requireOwner(serverTx, { userID: 'user-a' }, 'user-b', {
        action: 'update',
        resource: 'preferences',
      })
    ).toThrow(PermissionError);

    expect(() =>
      denyPublicApiMutation(serverTx, { action: 'create', resource: 'notifications' })
    ).toThrow(PermissionError);
  });

  it('accepts authenticated self, owner and matching actor mutations', () => {
    expect(() => requireAuthenticated(serverTx, { userID: 'user-a' })).not.toThrow();
    expect(() => requireSelf(serverTx, { userID: 'user-a' }, 'user-a')).not.toThrow();
    expect(() =>
      requireOwner(serverTx, { userID: 'user-a' }, 'user-a', {
        action: 'update',
        resource: '$users',
      })
    ).not.toThrow();
    expect(() => requireActorMatches(serverTx, { userID: 'user-a' }, 'user-a')).not.toThrow();
  });

  it('uses stable default and custom permission error metadata', () => {
    expect(() => requireAuthenticated(serverTx, { userID: '' })).toThrowError(
      expect.objectContaining({
        action: 'manage',
        resource: '$users',
        scope: 'authentication required',
      })
    );
    expect(() =>
      requireAuthenticated(
        serverTx,
        { userID: 'anon' },
        {
          action: 'create',
          resource: 'groups',
          scope: 'custom-auth-scope',
        }
      )
    ).toThrowError(
      expect.objectContaining({
        action: 'create',
        resource: 'groups',
        scope: 'custom-auth-scope',
      })
    );
    expect(() => requireSelf(serverTx, { userID: 'user-a' }, null)).toThrowError(
      expect.objectContaining({
        action: 'manage',
        resource: '$users',
        scope: 'user:unknown',
      })
    );
    expect(() =>
      requireActorMatches(serverTx, { userID: 'user-a' }, 'user-b', {
        action: 'update',
        resource: 'preferences',
        scope: 'actor-mismatch',
      })
    ).toThrowError(
      expect.objectContaining({
        action: 'update',
        resource: 'preferences',
        scope: 'actor-mismatch',
      })
    );
  });

  it('initializes stable permission defaults in an isolated module', async () => {
    vi.resetModules();
    const isolatedAuthorize = await import('../authorize');

    expect(() => isolatedAuthorize.requireAuthenticated(serverTx, { userID: 'anon' })).toThrowError(
      expect.objectContaining({
        action: 'manage',
        resource: '$users',
        scope: 'authentication required',
      })
    );
  });

  it('marks public API mutations as server-only unless a scope is supplied', () => {
    expect(() =>
      denyPublicApiMutation(serverTx, { action: 'create', resource: 'notifications' })
    ).toThrowError(expect.objectContaining({ scope: 'server-only' }));
    expect(() =>
      denyPublicApiMutation(serverTx, {
        action: 'delete',
        resource: 'notifications',
        scope: 'explicit-scope',
      })
    ).toThrowError(expect.objectContaining({ scope: 'explicit-scope' }));
  });

  it('mirrors public/authenticated/private visibility semantics', () => {
    expect(canReadVisibility('public', { userID: 'anon' })).toBe(true);
    expect(canReadVisibility('authenticated', { userID: 'anon' })).toBe(false);
    expect(canReadVisibility('authenticated', { userID: 'user-a' })).toBe(true);
    expect(canReadVisibility('private', { userID: 'user-a' })).toBe(false);
    expect(canReadVisibility('private', { userID: 'user-a' }, true)).toBe(true);
    expect(canReadVisibility('private', { userID: 'anon' }, true)).toBe(false);
    expect(canReadVisibility('unexpected', { userID: 'user-a' }, true)).toBe(true);
    expect(canReadVisibility(null, { userID: 'user-a' })).toBe(false);
  });
});
