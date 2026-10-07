import { useState } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { CanvasChangeRequestList } from '../CanvasChangeRequestList';
import {
  CanvasChangeRequestCard,
  CanvasChangeRequestCloseButton,
} from '../CanvasChangeRequestCard';
import { CanvasChangeRequestMarker } from '../CanvasChangeRequestMarker';
import '@/styles.css';

afterEach(cleanup);
function List() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div style={{ position: 'relative', height: 400, width: 600 }}>
      <CanvasChangeRequestList
        items={[{ id: 'first' }, { id: 'second' }]}
        selectedId={selected}
        onSelect={setSelected}
        title="Requests"
        emptyLabel="Empty"
        collapsible
        renderItem={(item, active, select) => (
          <button onClick={select} aria-pressed={active}>
            {item.id}
          </button>
        )}
      />
    </div>
  );
}
it('selects and closes list requests, collapses with the native keyboard and retains focus on each surviving control', async () => {
  render(<List />);
  const trigger = page.getByRole('button', { name: 'Requests (2)' });
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
  trigger.element().focus();
  await expect.element(trigger).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect.element(trigger).toHaveFocus();
  await userEvent.keyboard(' ');
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
  const row = page.getByRole('button', { name: 'first', exact: true });
  row.element().focus();
  await expect.element(row).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect.element(row).toHaveAttribute('aria-pressed', 'true');
  const close = page.getByRole('button', { name: 'Close', exact: true });
  await expect
    .element(close)
    .toHaveAttribute('data-action-id', 'shared.canvas-change-request.list.close');
  close.element().focus();
  await expect.element(close).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect.element(row).toHaveAttribute('aria-pressed', 'false');
  await expect.element(close).not.toBeInTheDocument();
});

it.each([true, false])(
  'renders a %s labelled request card and closes it with native keyboard activation',
  async labelled => {
    const onClose = vi.fn();
    render(
      <CanvasChangeRequestCard label={labelled ? 'Request details' : undefined} className="border">
        <p>Retained request</p>
        <CanvasChangeRequestCloseButton label="Close details" onClose={onClose} />
      </CanvasChangeRequestCard>
    );
    const close = page.getByRole('button', { name: 'Close details' });
    await expect
      .element(close)
      .toHaveAttribute('data-action-id', 'shared.canvas-change-request.card.close');
    close.element().focus();
    await expect.element(close).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await expect.element(close).toHaveFocus();
    if (labelled)
      await expect.element(page.getByRole('region', { name: 'Request details' })).toBeVisible();
    else await expect.element(page.getByRole('region')).not.toBeInTheDocument();
  }
);

it.each(['add', 'remove', 'update', 'neutral'] as const)(
  'selects and clears the %s marker using native keyboard input and prevents canvas pointer propagation',
  async tone => {
    const parent = vi.fn();
    function Marker() {
      const [selected, setSelected] = useState(false);
      return (
        <div
          onClick={parent}
          onPointerDown={parent}
          style={{ position: 'relative', width: 600, height: 400 }}
        >
          <CanvasChangeRequestMarker
            actionId={tone === 'neutral' ? '' : 'test.request.marker.select'}
            displayId="001"
            label="Select request"
            title="A useful change"
            tone={tone}
            selected={selected}
            style={{ left: 200, top: 100 }}
            onSelect={() => setSelected(value => !value)}
          />
        </div>
      );
    }
    render(<Marker />);
    const marker = page.getByRole('button', { name: 'Select request' });
    await expect.element(marker).toHaveAttribute('aria-pressed', 'false');
    marker.element().focus();
    await expect.element(marker).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect.element(marker).toHaveAttribute('aria-pressed', 'true');
    await expect.element(marker).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect.element(marker).toHaveAttribute('aria-pressed', 'false');
    await marker.click();
    await expect.element(marker).toHaveAttribute('aria-pressed', 'true');
    expect(parent).not.toHaveBeenCalled();
    await expect.element(marker).toHaveAttribute('data-change-request-tone', tone);
  }
);
