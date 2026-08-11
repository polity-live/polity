/* @vitest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { AuthCallbackPageView } from '@/features/auth/ui/AuthCallbackPageView';
import { AsButtonNavigation } from '../as-button-navigation';

const mocks = vi.hoisted(() => ({
  controller: vi.fn(() => ({ selectedIndex: 2, onSelect: vi.fn() })),
  navigationProps: [] as Record<string, unknown>[],
  loadingProps: [] as { details: string; onRetry: () => void }[],
}));

vi.mock('../hooks/useAsButtonNavigationController', () => ({
  useAsButtonNavigationController: () => mocks.controller(),
}));

vi.mock('../AsButtonNavigationView', () => ({
  AsButtonNavigationView: (props: Record<string, unknown>) => {
    mocks.navigationProps.push(props);
    return <div data-testid="navigation-view" />;
  },
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  AppBootLoadingState: (props: { details: string; onRetry: () => void; children?: ReactNode }) => {
    mocks.loadingProps.push(props);
    return <div data-testid="loading-view" />;
  },
}));

describe('adapter component contracts', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.navigationProps.length = 0;
    mocks.loadingProps.length = 0;
    mocks.controller.mockClear();
  });

  it('combines navigation props with its controller output', () => {
    const navigationItems = [{ title: 'Groups', url: '/groups' }];
    const props = {
      navigationItems,
      navigationView: 'main',
      navigationType: 'button',
      isMobile: true,
      screenType: 'mobile',
    } as unknown as ComponentProps<typeof AsButtonNavigation>;
    render(<AsButtonNavigation {...props} />);

    expect(mocks.controller).toHaveBeenCalledOnce();
    expect(mocks.navigationProps[0]).toMatchObject({
      navigationItems,
      navigationView: 'main',
      navigationType: 'button',
      isMobile: true,
      screenType: 'mobile',
      selectedIndex: 2,
    });
  });

  it('publishes the auth callback loading state and an executable retry', () => {
    render(<AuthCallbackPageView />);
    expect(mocks.loadingProps[0]?.details).toBe('/auth/callback');
    expect(mocks.loadingProps[0]?.onRetry).toEqual(expect.any(Function));
    mocks.loadingProps[0]?.onRetry();
  });
});
