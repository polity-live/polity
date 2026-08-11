/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddTodoDialogView } from '../AddTodoDialogView';

HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
HTMLElement.prototype.setPointerCapture = vi.fn();
HTMLElement.prototype.releasePointerCapture = vi.fn();
HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/create/ui/inputs/TodoDeadlineInput', () => ({
  TodoDeadlineInput: () => <div data-testid="deadline" />,
}));

afterEach(cleanup);

describe('AddTodoDialogView actions', () => {
  it('edits and submits a task through stable dialog actions', () => {
    const onTitleChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const onSubmit = vi.fn(event => event.preventDefault());
    const { container } = render(
      <AddTodoDialogView
        open
        onOpenChange={vi.fn()}
        title="Task"
        description=""
        priority="medium"
        dueDate=""
        dueTime=""
        onTitleChange={onTitleChange}
        onDescriptionChange={onDescriptionChange}
        onPriorityChange={vi.fn()}
        onDueDateChange={vi.fn()}
        onDueTimeChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('generated.inline.0028_title_768e0c1c'), {
      target: { value: 'Prepare agenda' },
    });
    fireEvent.change(screen.getByLabelText('generated.inline.0030_description_55f8ebc8'), {
      target: { value: 'Collect proposals' },
    });
    const submit = document.querySelector<HTMLElement>(
      '[data-action-id="groups.todos.create.submit"]'
    )!;
    submit.focus();
    expect(document.activeElement).toBe(submit);
    fireEvent.submit(submit.closest('form')!);

    expect(onTitleChange).toHaveBeenCalledWith('Prepare agenda');
    expect(onDescriptionChange).toHaveBeenCalledWith('Collect proposals');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-action-id="groups.todos.open.create-dialog"]')
    ).toBeTruthy();
  });

  it('selects every priority through explicit option identities', () => {
    const onPriorityChange = vi.fn();
    render(
      <AddTodoDialogView
        open
        onOpenChange={vi.fn()}
        title="Task"
        description=""
        priority="medium"
        dueDate=""
        dueTime=""
        onTitleChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onPriorityChange={onPriorityChange}
        onDueDateChange={vi.fn()}
        onDueTimeChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const trigger = document.querySelector<HTMLElement>(
      '[data-action-id="groups.todos.priority.open"]'
    )!;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.pointerDown(trigger, {
      button: 0,
      buttons: 1,
      ctrlKey: false,
      pointerId: 1,
      pointerType: 'mouse',
    });
    const urgent = document.querySelector<HTMLElement>(
      '[data-action-id="groups.todos.priority.choose-urgent"]'
    );
    expect(urgent).toBeTruthy();
    if (urgent) fireEvent.click(urgent);
    expect(onPriorityChange).toHaveBeenCalledWith('urgent');
  });
});
