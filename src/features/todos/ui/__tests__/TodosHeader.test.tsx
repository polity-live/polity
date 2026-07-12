/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TodosHeader } from '../TodosHeader';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'features.todos.title'
        ? 'My Todos'
        : key === 'features.todos.create.newTodo'
          ? 'New Todo'
          : key,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/create/todo">{children}</a>,
}));

afterEach(cleanup);

describe('TodosHeader', () => {
  it('keeps the route title semantic while rendering only view and create controls', () => {
    render(<TodosHeader viewMode="list" setViewMode={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'My Todos' }).className).toContain('sr-only');
    expect(screen.getByText('New Todo')).toBeTruthy();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(3);
  });
});
