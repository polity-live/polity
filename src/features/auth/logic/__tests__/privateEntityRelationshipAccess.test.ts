import { describe, expect, it } from 'vitest';

import {
  hasPrivateAmendmentRouteAccess,
  hasPrivateBlogRouteAccess,
  hasPrivateEventRouteAccess,
  hasPrivateGroupRouteAccess,
} from '../privateEntityRelationshipAccess';

describe('privateEntityRelationshipAccess', () => {
  it('allows private group access for owners and active members only', () => {
    expect(hasPrivateGroupRouteAccess('user-1', 'user-1', [])).toBe(true);
    expect(hasPrivateGroupRouteAccess('user-1', 'user-2', ['active'])).toBe(true);
    expect(hasPrivateGroupRouteAccess('user-1', 'user-2', ['invited'])).toBe(false);
  });

  it('allows private amendment access for creators and active collaborators only', () => {
    expect(hasPrivateAmendmentRouteAccess('user-1', 'user-1', [])).toBe(true);
    expect(hasPrivateAmendmentRouteAccess('user-1', 'user-2', ['collaborator'])).toBe(true);
    expect(hasPrivateAmendmentRouteAccess('user-1', 'user-2', ['requested'])).toBe(false);
  });

  it('allows private event access for creators and active participants only', () => {
    expect(hasPrivateEventRouteAccess('user-1', 'user-1', [])).toBe(true);
    expect(hasPrivateEventRouteAccess('user-1', 'user-2', ['confirmed'])).toBe(true);
    expect(hasPrivateEventRouteAccess('user-1', 'user-2', ['invited'])).toBe(false);
  });

  it('allows private blog access for active bloggers only', () => {
    expect(hasPrivateBlogRouteAccess('user-1', ['owner'])).toBe(true);
    expect(hasPrivateBlogRouteAccess('user-1', ['member'])).toBe(true);
    expect(hasPrivateBlogRouteAccess('user-1', ['requested'])).toBe(false);
  });
});
