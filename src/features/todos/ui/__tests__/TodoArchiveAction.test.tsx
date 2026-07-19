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
    fireEvent.click(screen.getByRole('button', { name: 'features.todos.actions.unarchive' }));
    expect(onUnarchive).toHaveBeenCalledOnce();
  });
});
