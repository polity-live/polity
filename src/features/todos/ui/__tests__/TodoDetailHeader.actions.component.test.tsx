/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TodoDetailHeader } from '../TodoDetailHeader';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

afterEach(cleanup);

describe('TodoDetailHeader action contracts', () => {
  it('edits, saves, and cancels through stable focusable actions', () => {
    const onEdit = vi.fn();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <TodoDetailHeader
        isEditing={false}
        isSaving={false}
        title="Todo"
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    const edit = document.querySelector('[data-action-id="todos.detail-header.edit"]')!;
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledOnce();

    rerender(
      <TodoDetailHeader
        isEditing
        isSaving={false}
        title="Todo"
        formTitle="Draft"
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
    const save = document.querySelector(
      '[data-action-id="todos.detail-header.save"]'
    ) as HTMLButtonElement;
    const cancel = document.querySelector(
      '[data-action-id="todos.detail-header.cancel"]'
    ) as HTMLButtonElement;
    save.focus();
    expect(document.activeElement).toBe(save);
    fireEvent.click(save);
    fireEvent.click(cancel);
    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables save and cancel while persistence is pending', () => {
    render(
      <TodoDetailHeader
        isEditing
        isSaving
        title="Todo"
        formTitle="Draft"
        onEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(
      (document.querySelector('[data-action-id="todos.detail-header.save"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (document.querySelector('[data-action-id="todos.detail-header.cancel"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('keeps archive actions while hiding edit without permission', () => {
    render(
      <TodoDetailHeader
        isEditing={false}
        isSaving={false}
        title="Todo"
        onEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        canEdit={false}
        archiveAction={<button type="button">Archive</button>}
      />
    );
    expect(document.querySelector('[data-action-id="todos.detail-header.edit"]')).toBeNull();
    expect(document.querySelector('button')?.textContent).toBe('Archive');
  });
});
