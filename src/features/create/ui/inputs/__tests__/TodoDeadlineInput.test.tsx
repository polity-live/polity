/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodoDeadlineInput } from '../TodoDeadlineInput';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

afterEach(cleanup);

describe('TodoDeadlineInput', () => {
  it('uses the shared calendar design and disables time until a date is selected', () => {
    render(<TodoDeadlineInput dueDate="" dueTime="" onChange={vi.fn()} />);

    expect(screen.getByText('pages.create.todo.dueDateOptional')).toBeTruthy();
    expect(
      (screen.getByLabelText('pages.create.todo.dueTimeOptional') as HTMLInputElement).disabled
    ).toBe(true);
  });

  it('clears date and time together', () => {
    const onChange = vi.fn();
    render(<TodoDeadlineInput dueDate="2026-07-19" dueTime="14:30" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'common.clear' }));

    expect(onChange).toHaveBeenCalledWith({ dueDate: '', dueTime: '' });
  });
});
