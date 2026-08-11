/* @vitest-environment jsdom */

import { Circle } from 'lucide-react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreateDashboardView } from '../CreateDashboardView';
import { CreateRecoveryState } from '../CreateRecoveryState';
import { FormStyleSelectorView } from '../FormStyleSelectorView';

const recovery = vi.hoisted(() => ({
  retry: vi.fn(),
  restore: vi.fn(),
  discard: vi.fn(),
  canRetry: true,
}));

vi.mock('@/features/create/hooks/useCreateRecoveryActions', () => ({
  useCreateRecoveryActions: () => ({
    ...recovery,
    isRetrying: false,
    canRetry: recovery.canRetry,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  recovery.canRetry = true;
});

describe('create foundation action contracts', () => {
  it('opens dashboard creation flows as stable deep links', () => {
    render(
      <CreateDashboardView
        accessibleTitle="Create"
        sections={[
          {
            key: 'organization',
            title: 'Organization',
            items: [
              {
                href: '/create/group',
                icon: Circle,
                title: 'Group',
                description: 'Create a group',
              },
            ],
          },
        ]}
      />
    );

    const link = document.querySelector(
      '[data-action-id="create.dashboard.flow.open"]'
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/create/group');
    link.focus();
    expect(document.activeElement).toBe(link);
  });

  it('selects each form layout with one canonical selection intent', () => {
    const onStyleChange = vi.fn();
    render(<FormStyleSelectorView selectedFormStyle="auto" onStyleChange={onStyleChange} />);
    const styleActions = document.querySelectorAll('[data-action-id="create.form-style.select"]');
    expect(styleActions).toHaveLength(3);
    styleActions.forEach(element => fireEvent.click(element));
    expect(onStyleChange.mock.calls.map(([value]) => value)).toEqual([
      'carousel',
      'one_page',
      'auto',
    ]);
  });

  it('retries, restores, and discards failed drafts without shared state', () => {
    render(
      <CreateRecoveryState
        draft={{ status: 'failed', entityType: 'group', errorMessage: 'Failed' } as any}
      />
    );
    for (const [id, handler] of [
      ['create.recovery.retry', recovery.retry],
      ['create.recovery.restore', recovery.restore],
      ['create.recovery.discard', recovery.discard],
    ] as const) {
      const element = document.querySelector(`[data-action-id="${id}"]`) as HTMLElement;
      fireEvent.click(element);
      expect(handler).toHaveBeenCalledOnce();
    }
  });

  it('hides retry when the failed draft cannot be retried', () => {
    recovery.canRetry = false;
    render(
      <CreateRecoveryState
        draft={{ status: 'failed', entityType: 'group', errorMessage: 'Failed' } as any}
      />
    );

    expect(document.querySelector('[data-action-id="create.recovery.retry"]')).toBeNull();
    expect(document.querySelector('[data-action-id="create.recovery.restore"]')).toBeTruthy();
  });

  it('renders pending recovery and the default failed explanation', () => {
    const { rerender } = render(
      <CreateRecoveryState draft={{ status: 'pending', entityType: 'todo' } as any} />
    );

    expect(document.querySelector('h1')).toBeTruthy();
    expect(document.querySelector('[data-action-id="create.recovery.restore"]')).toBeNull();

    rerender(<CreateRecoveryState draft={{ status: 'failed', entityType: 'todo' } as any} />);
    expect(document.querySelector('[data-action-id="create.recovery.restore"]')).toBeTruthy();
  });
});
