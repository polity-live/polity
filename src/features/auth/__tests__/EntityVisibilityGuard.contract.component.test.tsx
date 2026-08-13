/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { EntityVisibilityGuard } from '../EntityVisibilityGuard';

const mocks = vi.hoisted(() => ({
  useController: vi.fn((input: object) => ({ state: 'allowed', input })),
  viewProps: [] as { guard: unknown; children: ReactNode }[],
}));

vi.mock('../hooks/useEntityVisibilityGuardController', () => ({
  useEntityVisibilityGuardController: (input: object) => mocks.useController(input),
}));

vi.mock('../EntityVisibilityGuardView', () => ({
  EntityVisibilityGuardView: (props: { guard: unknown; children: ReactNode }) => {
    mocks.viewProps.push(props);
    return <div data-testid="guard-view">{props.children}</div>;
  },
}));

describe('EntityVisibilityGuard contract', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.useController.mockClear();
    mocks.viewProps.length = 0;
  });

  it('passes safe defaults and children through controller and view', () => {
    render(
      <EntityVisibilityGuard
        entityExists
        isLoading={false}
        visibilities={[{ visibility: 'public' }] as never}
      >
        Content
      </EntityVisibilityGuard>
    );

    expect(screen.getByTestId('guard-view').textContent).toBe('Content');
    expect(mocks.useController).toHaveBeenCalledWith({
      entityExists: true,
      hasError: false,
      isLoading: false,
      visibilities: [{ visibility: 'public' }],
      canAccessPrivate: false,
      recoveryDraft: null,
    });
    expect(mocks.viewProps[0]?.guard).toMatchObject({ state: 'allowed' });
  });

  it('forwards explicit error, private access and recovery state', () => {
    const recoveryDraft = { entityType: 'event' };
    render(
      <EntityVisibilityGuard
        entityExists={false}
        hasError
        isLoading
        visibilities={[]}
        canAccessPrivate
        recoveryDraft={recoveryDraft as never}
      >
        Hidden
      </EntityVisibilityGuard>
    );

    expect(mocks.useController).toHaveBeenCalledWith(
      expect.objectContaining({
        hasError: true,
        canAccessPrivate: true,
        recoveryDraft,
      })
    );
  });
});
