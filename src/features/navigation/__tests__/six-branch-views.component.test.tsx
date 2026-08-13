/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DynamicNavigationView } from '../DynamicNavigationView';
import { NavigationDemoView } from '../NavigationDemoView';

vi.mock('../as-button-navigation.tsx', () => ({ AsButtonNavigation: () => <div>as-button</div> }));
vi.mock('../as-button-list-navigation.tsx', () => ({
  AsButtonListNavigation: () => <div>as-list</div>,
}));
vi.mock('../as-labeled-button-list-navigation.tsx', () => ({
  AsLabeledButtonListNavigation: () => <div>as-labeled</div>,
}));
vi.mock('../toggles/theme-toggle.tsx', () => ({ ThemeToggle: () => <div>theme</div> }));

afterEach(cleanup);

describe('six-branch navigation views', () => {
  it.each([
    ['asButton', 'as-button'],
    ['asButtonList', 'as-list'],
    ['asLabeledButtonList', 'as-labeled'],
  ] as const)('renders the %s dynamic navigation variant', (navigationView, text) => {
    render(
      <DynamicNavigationView
        navigationView={navigationView}
        navigationType="primary"
        navigationItems={[]}
        isMobileDevice={false}
        screenType="desktop"
      />
    );
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('returns null for an unsupported runtime navigation view', () => {
    expect(
      render(
        <DynamicNavigationView
          navigationView={'unsupported' as never}
          navigationType="primary"
          navigationItems={[]}
          isMobileDevice={false}
          screenType="desktop"
        />
      ).container.firstChild
    ).toBeNull();
  });

  it('renders all demo states and invokes screen and priority actions', () => {
    const handleScreenTypeChange = vi.fn();
    const handlePriorityChange = vi.fn();
    const props = {
      t: (key: string) => key,
      screenType: 'mobile',
      actualScreen: 'mobile',
      priority: 'primary',
      handleScreenTypeChange,
      handlePriorityChange,
    } as ComponentProps<typeof NavigationDemoView>;
    const { rerender } = render(<NavigationDemoView {...props} />);
    fireEvent.click(document.querySelector('[data-action-id="navigation.demo.screen.mobile"]')!);
    fireEvent.click(document.querySelector('[data-action-id="navigation.demo.screen.desktop"]')!);
    fireEvent.click(document.querySelector('[data-action-id="navigation.demo.screen.automatic"]')!);
    fireEvent.click(document.querySelector('[data-action-id="navigation.demo.priority.primary"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.demo.priority.secondary"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.demo.priority.combined"]')!
    );
    expect(handleScreenTypeChange.mock.calls.map(call => call[0])).toEqual([
      'mobile',
      'desktop',
      'automatic',
    ]);
    expect(handlePriorityChange.mock.calls.map(call => call[0])).toEqual([
      'primary',
      'secondary',
      'combined',
    ]);
    rerender(<NavigationDemoView {...props} screenType="desktop" priority="secondary" />);
    rerender(<NavigationDemoView {...props} screenType="automatic" priority="combined" />);
    expect(screen.getAllByText(/sampleContent.title/)).toHaveLength(6);
  });
});
