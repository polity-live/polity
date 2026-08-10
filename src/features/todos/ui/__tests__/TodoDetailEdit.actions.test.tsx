/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TodoDetailEdit } from '../TodoDetailEdit';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/create/ui/inputs/TodoDeadlineInput', () => ({
  TodoDeadlineInput: () => null,
}));

vi.mock('@/features/shared/ui/form', async () => {
  const { createContext, useContext } = await import('react');
  const SelectContext = createContext<(value: string) => void>(() => undefined);
  return {
    FormControlLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    FormControlTextarea: (props: Record<string, unknown>) => <textarea {...props} />,
    FormControlSelect: ({ children, onValueChange, ...props }: any) => (
      <SelectContext.Provider value={onValueChange}>
        <div {...props}>{children}</div>
      </SelectContext.Provider>
    ),
    FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    FormControlSelectTrigger: ({ children, ...props }: any) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    FormControlSelectValue: () => <span>Select</span>,
    FormControlSelectItem: ({ children, value, ...props }: any) => {
      const onValueChange = useContext(SelectContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
  };
});

afterEach(cleanup);

describe('TodoDetailEdit action contracts', () => {
  it('updates every status and priority option through stable selection intents', () => {
    const onUpdate = vi.fn();
    render(
      <TodoDetailEdit
        formData={{
          title: 'Todo',
          description: '',
          status: 'pending',
          priority: 'medium',
          dueDate: '',
          dueTime: '',
        }}
        onUpdate={onUpdate}
      />
    );

    const statusTrigger = document.querySelector(
      '[data-action-id="todos.detail-edit.status.select"] button'
    ) as HTMLButtonElement;
    statusTrigger.focus();
    fireEvent.keyDown(statusTrigger, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(statusTrigger);

    for (const status of ['pending', 'in-progress', 'completed', 'cancelled']) {
      fireEvent.click(
        document.querySelector(`[data-action-id="todos.detail-edit.status.${status}"]`)!
      );
    }
    for (const priority of ['low', 'medium', 'high', 'urgent']) {
      fireEvent.click(
        document.querySelector(`[data-action-id="todos.detail-edit.priority.${priority}"]`)!
      );
    }

    expect(onUpdate).toHaveBeenCalledWith({ status: 'in_progress' });
    expect(onUpdate).toHaveBeenCalledWith({ status: 'completed' });
    expect(onUpdate).toHaveBeenCalledWith({ priority: 'urgent' });
  });
});
