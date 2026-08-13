/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FloatingNavigationButton,
  NavigationCloseButton,
  NavigationIconToggleButton,
} from '../NavigationButtons';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) =>
    ({
      'navigation.toggles.state.toggleNavigation': 'Toggle navigation',
      'navigation.toggles.state.closeNavigation': 'Close navigation',
    })[key] ?? key,
}));

afterEach(cleanup);

describe('navigation icon-button accessibility', () => {
  it('names floating and close controls without relying on their icons', () => {
    render(
      <>
        <FloatingNavigationButton
          side="left"
          isExpanded={false}
          onExpand={vi.fn()}
          onToggleExpanded={vi.fn()}
          icon={<span aria-hidden="true">+</span>}
        />
        <NavigationCloseButton side="left" onClose={vi.fn()} />
        <FloatingNavigationButton
          side="right"
          isExpanded
          onExpand={vi.fn()}
          onToggleExpanded={vi.fn()}
          icon={<span aria-hidden="true">R</span>}
        />
        <NavigationCloseButton side="right" onClose={vi.fn()} className="custom" />
      </>
    );

    expect(screen.getAllByRole('button', { name: 'Toggle navigation' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Close navigation' })).toHaveLength(2);
  });

  it('renders active and inactive icon toggles at both sizes', () => {
    const Icon = ({ className }: { className?: string }) => <span className={className}>I</span>;
    const first = render(
      <NavigationIconToggleButton
        value="one"
        currentValue="one"
        onClick={vi.fn()}
        icon={Icon}
        title="Default icon"
      />
    );
    expect(screen.getByRole('button', { name: 'Default icon' }).className).toContain('h-8');
    first.unmount();

    render(
      <NavigationIconToggleButton
        value="one"
        currentValue="two"
        onClick={vi.fn()}
        icon={Icon}
        title="Small icon"
        size="small"
      />
    );
    expect(screen.getByRole('button', { name: 'Small icon' }).className).toContain('h-6');
    expect(screen.getByText('I').className).toContain('h-3');
  });
});
