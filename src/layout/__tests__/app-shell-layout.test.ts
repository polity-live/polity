import { describe, expect, it } from 'vitest';

import {
  APP_SHELL_PAGE_FRAME_CLASS,
  getAppShellResponsiveClasses,
  getAuthenticatedPageFrame,
  getUnauthenticatedPageFrame,
} from '../app-shell-layout';

describe('app shell page frame routing', () => {
  it('uses CSS-first offsets for automatic button-list navigation', () => {
    expect(
      getAppShellResponsiveClasses({
        screenType: 'automatic',
        navigationView: 'asButtonList',
        isSecondaryNavVisible: true,
      })
    ).toContain('mt-16 mb-16');
    expect(
      getAppShellResponsiveClasses({
        screenType: 'automatic',
        navigationView: 'asButtonList',
        isSecondaryNavVisible: true,
      })
    ).toContain('md:ml-16 md:mr-16');
    expect(
      getAppShellResponsiveClasses({
        screenType: 'automatic',
        navigationView: 'asButtonList',
        isSecondaryNavVisible: true,
      })
    ).toContain('md:[--app-shell-mobile-bottom-offset:0rem]');
  });

  it('keeps forced mobile and desktop navigation modes independent of the viewport', () => {
    expect(
      getAppShellResponsiveClasses({
        screenType: 'mobile',
        navigationView: 'asLabeledButtonList',
        isSecondaryNavVisible: true,
      })
    ).toBe(
      'mt-20 mb-20 [--app-shell-mobile-top-offset:5rem] [--app-shell-mobile-bottom-offset:5rem]'
    );
    expect(
      getAppShellResponsiveClasses({
        screenType: 'desktop',
        navigationView: 'asLabeledButtonList',
        isSecondaryNavVisible: true,
      })
    ).toBe(
      'ml-64 mr-64 [--app-shell-mobile-top-offset:0rem] [--app-shell-mobile-bottom-offset:0rem]'
    );
  });

  it('contains entity wiki and detail pages for every authentication state', () => {
    const paths = [
      '/group/group-1',
      '/user/user-1',
      '/event/event-1',
      '/amendment/amendment-1',
      '/blog/blog-1',
      '/user/user-1/blog/blog-1',
      '/group/group-1/blog/blog-1',
    ];

    for (const path of paths) {
      expect(getUnauthenticatedPageFrame(path)).toBe('contained');
      expect(getAuthenticatedPageFrame(path)).toBe('contained');
    }

    expect(APP_SHELL_PAGE_FRAME_CLASS.contained).toContain('max-w-7xl');
    expect(APP_SHELL_PAGE_FRAME_CLASS.contained).toContain('px-4');
    expect(APP_SHELL_PAGE_FRAME_CLASS.contained).toContain('md:px-8');
  });

  it('contains regular entity subroutes consistently for every authentication state', () => {
    const paths = [
      '/group/group-1/settings',
      '/group/group-1/notifications',
      '/group/group-1/memberships',
      '/user/user-1/settings',
      '/user/user-1/notifications',
      '/user/user-1/memberships',
      '/event/event-1/settings',
      '/event/event-1/notifications',
      '/event/event-1/participants',
      '/blog/blog-1/edit',
      '/blog/blog-1/notifications',
      '/amendment/amendment-1/collaborators',
    ];

    for (const path of paths) {
      expect(getUnauthenticatedPageFrame(path)).toBe('contained');
      expect(getAuthenticatedPageFrame(path)).toBe('contained');
    }
  });

  it('keeps intentionally uncontained entity tools uncontained', () => {
    expect(getUnauthenticatedPageFrame('/group/group-1/network')).toBe('uncontained');
    expect(getUnauthenticatedPageFrame('/user/user-1/network')).toBe('uncontained');
    expect(getUnauthenticatedPageFrame('/event/event-1/network')).toBe('uncontained');
  });

  it('uses the same contained frame for all amendment entity sections', () => {
    const paths = [
      '/amendment/amendment-1',
      '/amendment/amendment-1/settings',
      '/amendment/amendment-1/notifications',
      '/amendment/amendment-1/collaborators',
      '/amendment/amendment-1/process',
      '/amendment/amendment-1/discussions',
      '/amendment/amendment-1/change-requests',
    ];

    for (const path of paths) {
      expect(getUnauthenticatedPageFrame(path)).toBe('contained');
      expect(getAuthenticatedPageFrame(path)).toBe('contained');
    }
  });

  it('contains the full text and streetscape amendment editors', () => {
    for (const path of ['/amendment/amendment-1/text', '/amendment/amendment-1/streetscape']) {
      expect(getUnauthenticatedPageFrame(path)).toBe('contained');
      expect(getAuthenticatedPageFrame(path)).toBe('contained');
    }
  });

  it('leaves signed-out public non-entity pages bare', () => {
    expect(getUnauthenticatedPageFrame('/')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/features')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/docs')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/auth/sign-in')).toBe('bare');
    expect(getUnauthenticatedPageFrame('/privacy-policy')).toBe('bare');
  });

  it('preserves authenticated shell frame variants', () => {
    expect(getAuthenticatedPageFrame('/docs')).toBe('bare');
    expect(getAuthenticatedPageFrame('/docs/guides/groups')).toBe('bare');
    expect(getAuthenticatedPageFrame('/messages')).toBe('messages');
    expect(getAuthenticatedPageFrame('/group/group-1/memberships')).toBe('contained');
    expect(getAuthenticatedPageFrame('/home')).toBe('fullWidth');
    expect(getAuthenticatedPageFrame('/search')).toBe('fullWidth');
    expect(getAuthenticatedPageFrame('/group/group-1/network')).toBe('uncontained');
    expect(APP_SHELL_PAGE_FRAME_CLASS.messages).toContain('pt-2');
    expect(APP_SHELL_PAGE_FRAME_CLASS.messages).toContain('md:py-6');
    expect(APP_SHELL_PAGE_FRAME_CLASS.messages).toContain('[--app-shell-page-frame-y:2rem]');
  });
});
