import { describe, expect, it } from 'vitest';
import {
  canReadVisibility,
  denyPublicApiMutation,
  requireAuthenticated,
  requireOwner,
} from '../authorize';
import { PermissionError } from '../errors';

const clientTx = { location: 'client' } as any;
const serverTx = { location: 'server' } as any;

describe('server authorization helpers', () => {
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

  it('mirrors public/authenticated/private visibility semantics', () => {
    expect(canReadVisibility('public', { userID: 'anon' })).toBe(true);
    expect(canReadVisibility('authenticated', { userID: 'anon' })).toBe(false);
    expect(canReadVisibility('authenticated', { userID: 'user-a' })).toBe(true);
    expect(canReadVisibility('private', { userID: 'user-a' })).toBe(false);
    expect(canReadVisibility('private', { userID: 'user-a' }, true)).toBe(true);
  });
});
