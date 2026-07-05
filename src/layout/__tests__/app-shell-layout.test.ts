import { describe, expect, it } from 'vitest';

import { getAuthenticatedPageFrame, getUnauthenticatedPageFrame } from '../app-shell-layout';

describe('app shell page frame routing', () => {
  it('leaves self-framed entity wiki and detail pages bare', () => {
    expect(getUnauthenticatedPageFrame('/group/group-1')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/user/user-1')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/event/event-1')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/amendment/amendment-1')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/blog/blog-1')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/user/user-1/blog/blog-1')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/group/group-1/blog/blog-1')).toBe('bare');
  });

  it('contains signed-out entity subroutes that do not frame themselves', () => {
    expect(getUnauthenticatedPageFrame('/group/group-1/memberships')).toBe('contained');
    expect(getUnauthenticatedPageFrame('/user/user-1/memberships')).toBe('contained');
    expect(getUnauthenticatedPageFrame('/event/event-1/participants')).toBe('contained');
    expect(getUnauthenticatedPageFrame('/amendment/amendment-1/collaborators')).toBe('contained');
  });

  it('keeps intentionally uncontained entity tools uncontained', () => {
    expect(getUnauthenticatedPageFrame('/group/group-1/network')).toBe('uncontained');
    expect(getUnauthenticatedPageFrame('/user/user-1/network')).toBe('uncontained');
    expect(getUnauthenticatedPageFrame('/event/event-1/network')).toBe('uncontained');
    expect(getUnauthenticatedPageFrame('/amendment/amendment-1/process')).toBe('uncontained');
  });

  it('contains the streetscape editor like the full text amendment editor', () => {
    expect(getUnauthenticatedPageFrame('/amendment/amendment-1/streetscape')).toBe('contained');
    expect(getAuthenticatedPageFrame('/amendment/amendment-1/streetscape')).toBe('contained');
  });

  it('leaves signed-out public non-entity pages bare', () => {
    expect(getUnauthenticatedPageFrame('/')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/features')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/docs')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/auth/sign-in')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/privacy-policy')).toBe('bare');
  });

  it('preserves authenticated shell frame variants', () => {
    expect(getAuthenticatedPageFrame('/group/group-1')).toBe('bare');
    expect(getAuthenticatedPageFrame('/group/group-1/memberships')).toBe('contained');
    expect(getAuthenticatedPageFrame('/home')).toBe('fullWidth');
    expect(getAuthenticatedPageFrame('/search')).toBe('fullWidth');
    expect(getAuthenticatedPageFrame('/group/group-1/network')).toBe('uncontained');
  });
});
