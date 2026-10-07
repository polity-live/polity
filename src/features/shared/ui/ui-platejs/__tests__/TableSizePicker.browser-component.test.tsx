import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { TableSizePicker } from '../TableSizePicker';
import '@/styles.css';

it('chooses table dimensions with native keyboard focus and never inserts an empty selection', async () => {
  const select = vi.fn();
  render(<TableSizePicker rows={3} columns={4} onSelect={select} />);
  const picker = screen.getByRole('button', { name: 'Table size: 0 x 0' });
  expect(picker.getAttribute('data-action-id')).toBe('shared.table-size.dimensions.choose');
  picker.focus();
  expect(document.activeElement).toBe(picker);
  await userEvent.keyboard('{Enter} ');
  expect(select).not.toHaveBeenCalled();
  await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}');
  expect(picker.getAttribute('aria-label')).toBe('Table size: 2 x 2');
  await userEvent.keyboard('{Enter}');
  expect(select).toHaveBeenLastCalledWith({ rowCount: 2, colCount: 2 });
  await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}{ArrowRight}{ArrowRight} ');
  expect(select).toHaveBeenLastCalledWith({ rowCount: 3, colCount: 4 });
  await userEvent.keyboard(
    '{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowUp}{ArrowUp}{ArrowUp}{Enter}'
  );
  expect(select).toHaveBeenLastCalledWith({ rowCount: 1, colCount: 1 });
  const calls = select.mock.calls.length;
  await userEvent.keyboard('{Escape}{Home}{End}');
  expect(select).toHaveBeenCalledTimes(calls);
  expect(document.activeElement).toBe(picker);
});

it('selects actual hovered and clicked grid cells without bubbling a second insertion', async () => {
  const select = vi.fn();
  const ancestor = vi.fn();
  const view = render(
    <div onClick={ancestor}>
      <TableSizePicker rows={3} columns={4} onSelect={select} />
    </div>
  );
  const picker = screen.getByRole('button', { name: 'Table size: 0 x 0' });
  const cell = view.container.querySelector<HTMLElement>(
    '[data-table-size-row="3"][data-table-size-column="2"]'
  )!;
  await userEvent.hover(cell);
  expect(picker.getAttribute('aria-label')).toBe('Table size: 3 x 2');
  await userEvent.click(cell);
  expect(select).toHaveBeenCalledExactlyOnceWith({ rowCount: 3, colCount: 2 });
  expect(ancestor).not.toHaveBeenCalled();
  const caption = picker.querySelector('span')!;
  await userEvent.click(caption);
  expect(select).toHaveBeenCalledTimes(2);
  expect(select).toHaveBeenLastCalledWith({ rowCount: 3, colCount: 2 });
  expect(ancestor).toHaveBeenCalledOnce();
});
