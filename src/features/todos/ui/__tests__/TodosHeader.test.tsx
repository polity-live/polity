/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a href="/create/todo" {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe('TodosHeader', () => {
  it('keeps the route title semantic while rendering only view and create controls', () => {
    const setViewMode = vi.fn();
    render(<TodosHeader viewMode="list" setViewMode={setViewMode} />);

    expect(screen.getByRole('heading', { name: 'My Todos' }).className).toContain('sr-only');
    expect(screen.getByText('New Todo')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    const list = document.querySelector('[data-action-id="todos.header.view.list"]')!;
    const kanban = document.querySelector('[data-action-id="todos.header.view.kanban"]')!;
    const create = document.querySelector('[data-action-id="todos.header.create"]')!;
    expect(list.getAttribute('aria-label')).toBe('features.todos.view.list');
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fireEvent.click(kanban);
    expect(setViewMode).toHaveBeenCalledWith('kanban');
    expect(create.tagName).toBe('A');
  });
});
