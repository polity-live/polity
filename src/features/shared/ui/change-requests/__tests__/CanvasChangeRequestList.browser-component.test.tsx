import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { CanvasChangeRequestList } from '../CanvasChangeRequestList';
import '@/styles.css';

afterEach(cleanup);

const props = {
  items: [{ id: 'one', title: 'First request' }],
  selectedId: 'one',
  onSelect: vi.fn(),
  title: 'Change requests',
  emptyLabel: 'No change requests yet',
  renderItem: (item: { id: string; title: string }, selected: boolean, select: () => void) => (
    <button type="button" aria-pressed={selected} onClick={select}>
      {item.title}
    </button>
  ),
};

it('toggles with mouse and keyboard, preserves selection and stays collapsed after updates', async () => {
  const onSelect = vi.fn();
  const { rerender } = render(
    <CanvasChangeRequestList {...props} onSelect={onSelect} collapsible />
  );
  const trigger = screen.getByRole('button', { name: 'Change requests (1)' });
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  await userEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('button', { name: 'First request' })).toBeNull();
  expect(onSelect).not.toHaveBeenCalled();

  rerender(
    <CanvasChangeRequestList
      {...props}
      onSelect={onSelect}
      collapsible
      items={[...props.items, { id: 'two', title: 'Second request' }]}
    />
  );
  expect(
    screen.getByRole('button', { name: 'Change requests (2)' }).getAttribute('aria-expanded')
  ).toBe('false');
  await userEvent.keyboard('{Enter}');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('button', { name: 'First request' }).getAttribute('aria-pressed')).toBe(
    'true'
  );
  await userEvent.keyboard(' ');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  await userEvent.tab();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  await userEvent.keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledWith(null);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('collapses an empty list and starts expanded again after remounting', async () => {
  const { unmount } = render(
    <CanvasChangeRequestList {...props} items={[]} selectedId={null} collapsible />
  );
  expect(screen.getByText(props.emptyLabel)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Change requests (0)' }));
  expect(screen.queryByText(props.emptyLabel)).toBeNull();
  unmount();
  render(<CanvasChangeRequestList {...props} items={[]} selectedId={null} collapsible />);
  expect(
    screen.getByRole('button', { name: 'Change requests (0)' }).getAttribute('aria-expanded')
  ).toBe('true');
});

it('keeps the existing static list when collapsing is not enabled', () => {
  render(<CanvasChangeRequestList {...props} />);
  expect(screen.getByRole('heading', { name: 'Change requests (1)' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Change requests (1)' })).toBeNull();
  expect(screen.getByRole('button', { name: 'First request' })).toBeTruthy();
});

it('fits a narrow canvas with its trigger and close button visible', () => {
  render(
    <div style={{ position: 'relative', width: 240, height: 320 }}>
      <CanvasChangeRequestList {...props} collapsible />
    </div>
  );
  const trigger = screen
    .getByRole('button', { name: 'Change requests (1)' })
    .getBoundingClientRect();
  const close = screen.getByRole('button', { name: 'Close' }).getBoundingClientRect();
  expect(trigger.width).toBeGreaterThan(0);
  expect(trigger.right).toBeLessThanOrEqual(close.left);
  const panel = screen.getByRole('heading', { name: 'Change requests (1)' }).parentElement!
    .parentElement!;
  const canvas = panel.parentElement!.getBoundingClientRect();
  expect(close.right).toBeLessThanOrEqual(canvas.right);
  expect(panel.getBoundingClientRect().width).toBeLessThanOrEqual(canvas.width);
});
