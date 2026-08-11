/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TodoArchiveAction } from '../TodoArchiveAction';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('TodoArchiveAction', () => {
  it('only offers archiving for manageable completed todos', () => {
    const { rerender } = render(
      <TodoArchiveAction
        archived={false}
        canManage
        completed={false}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />
    );

    expect(screen.queryByRole('button')).toBeNull();

    rerender(
      <TodoArchiveAction
        archived={false}
        canManage
        completed
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'features.todos.actions.archive' })).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'features.todos.actions.archive' })
        .getAttribute('data-action-id')
    ).toBe('todos.archive.open');
  });

  it('confirms archiving and restores archived todos directly', () => {
    const onArchive = vi.fn();
    const onUnarchive = vi.fn();
    const { rerender } = render(
      <TodoArchiveAction
        archived={false}
        canManage
        completed
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'features.todos.actions.archive' }));
    const archiveButtons = screen.getAllByRole('button', {
      name: 'features.todos.actions.archive',
    });
    const confirmArchiveButton = archiveButtons.at(-1);
    if (!confirmArchiveButton) throw new Error('Archive confirmation button not found');
    expect(confirmArchiveButton.getAttribute('data-action-id')).toBe('todos.archive.confirm');
    fireEvent.click(confirmArchiveButton);
    expect(onArchive).toHaveBeenCalledOnce();

    rerender(
      <TodoArchiveAction
        archived
        canManage
        completed
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />
    );
    const restore = screen.getByRole('button', { name: 'features.todos.actions.unarchive' });
    expect(restore.getAttribute('data-action-id')).toBe('todos.archive.restore');
    restore.focus();
    expect(document.activeElement).toBe(restore);
    fireEvent.click(restore);
    expect(onUnarchive).toHaveBeenCalledOnce();
  });

  it('disables every archive transition while a mutation is pending', () => {
    const { rerender } = render(
      <TodoArchiveAction
        archived={false}
        canManage
        completed
        isPending
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />
    );

    expect(
      (document.querySelector('[data-action-id="todos.archive.open"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);

    rerender(
      <TodoArchiveAction
        archived
        canManage
        completed
        isPending
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />
    );
    expect(
      (document.querySelector('[data-action-id="todos.archive.restore"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
