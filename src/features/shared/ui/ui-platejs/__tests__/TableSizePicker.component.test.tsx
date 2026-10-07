/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TableSizePicker } from '../TableSizePicker';

afterEach(cleanup);

it('selects dimensions by pointer or keyboard and never inserts 0 x 0', () => {
  const onSelect = vi.fn();
  const view = render(<TableSizePicker onSelect={onSelect} />);
  const picker = screen.getByRole('button', { name: /table size/i });
  fireEvent.click(picker);
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.keyDown(picker, { key: 'ArrowRight' });
  fireEvent.keyDown(picker, { key: 'ArrowRight' });
  fireEvent.keyDown(picker, { key: 'ArrowDown' });
  fireEvent.keyDown(picker, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith({ rowCount: 2, colCount: 2 });
  fireEvent.mouseMove(view.container.querySelectorAll('.grid > div')[5 * 8 + 3]);
  fireEvent.click(picker);
  expect(onSelect).toHaveBeenLastCalledWith({ rowCount: 6, colCount: 4 });
});
