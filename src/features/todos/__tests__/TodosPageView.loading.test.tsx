/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TodosPageView } from '../TodosPageView';

afterEach(() => {
  cleanup();
});

describe('TodosPageView loading state', () => {
  it('renders a page skeleton while the user context loads', () => {
    render(
      <TodosPageView
        {...({
          t: (key: string) => (key === 'features.todos.loading' ? 'Loading todos' : key),
          user: null,
        } as any)}
      />
    );

    expect(document.querySelector('[data-slot="entity-page-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('Loading todos')).toBeNull();
  });
});
