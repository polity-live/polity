import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { Toolbar } from '@/features/shared/ui/layout';
import { StudioPanel, useStudioMobile } from '../StudioPanel';
import { openStudioPanel, STUDIO_OPEN_PANEL_EVENT } from '../../logic/panel-events';

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await page.viewport(1280, 800);
});

it('retains a desktop fallback when media-query detection is unavailable', () => {
  vi.stubGlobal('matchMedia', undefined);
  const { result } = renderHook(useStudioMobile);
  expect(result.current).toBe(false);
});

function mount(props: Partial<Parameters<typeof StudioPanel>[0]> = {}) {
  return render(
    <>
      <div
        data-navigation-type="secondary"
        style={{ position: 'fixed', right: 0, top: 0, width: 80, height: 700 }}
      >
        <button data-navigation-item-id="layers">Right layers</button>
        <button data-navigation-item-id="other">Right other</button>
      </div>
      <button data-navigation-item-id="horizontal">Horizontal layers</button>
      <button data-navigation-item-id="hidden" style={{ display: 'none' }}>
        Hidden layers
      </button>
      <button>Outside</button>
      <div data-canvas-engine="konva">
        <button>Canvas</button>
      </div>
      <Toolbar>
        <StudioPanel label="Layers" panelKey="layers" {...props}>
          <input aria-label="Layer name" data-studio-layer-name-input defaultValue="Initial" />
          <button>Panel action</button>
        </StudioPanel>
      </Toolbar>
    </>
  );
}

function request(detail: Parameters<typeof openStudioPanel>[0]) {
  act(() => openStudioPanel(detail));
}

function sidebar(navigationItemId: string | undefined = 'layers') {
  request({ panelKey: 'layers', origin: 'secondary-navigation', navigationItemId });
}

async function opened() {
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Layer name' })).toBeVisible());
}

async function closed() {
  await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Layer name' })).toBeNull());
}

it('opens and closes the toolbar popover by keyboard and restores trigger focus', async () => {
  mount();
  const trigger = screen.getByRole('button', { name: 'Layers' });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  await opened();
  await userEvent.click(screen.getByRole('button', { name: 'Panel action' }));
  await userEvent.keyboard('{Escape}');
  await closed();
  expect(trigger).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await opened();
  await userEvent.click(trigger);
  await closed();
});

it('preserves a layer rename on Escape while permitting normal panel dismissal', async () => {
  mount();
  request('layers');
  await opened();
  const input = screen.getByRole('textbox', { name: 'Layer name' });
  await userEvent.fill(input, 'Renamed');
  await userEvent.keyboard('{Escape}');
  expect(input).toBeVisible();
  expect(input).toHaveValue('Renamed');
  await userEvent.click(screen.getByRole('button', { name: 'Panel action' }));
  await userEvent.keyboard('{Escape}');
  await closed();
});

it('anchors a compact sidebar panel to the visible right navigation and restores its focus', async () => {
  mount({ compact: true });
  const anchor = screen.getByRole('button', { name: 'Right layers' });
  anchor.focus();
  sidebar();
  await opened();
  expect(screen.getByRole('dialog', { name: 'Layers' })).toHaveClass('w-80');
  await userEvent.click(screen.getByRole('button', { name: 'Panel action' }));
  await userEvent.keyboard('{Escape}');
  await closed();
  expect(anchor).toHaveFocus();
});

it('keeps a sidebar panel open during canvas interactions and dismisses it outside the canvas', async () => {
  mount({ keepOpenOnCanvasInteraction: true });
  sidebar();
  await opened();
  await userEvent.click(screen.getByRole('button', { name: 'Canvas' }));
  expect(screen.getByRole('textbox', { name: 'Layer name' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
  await closed();
});

it('dismisses a sidebar on canvas interactions when keeping it open is disabled', async () => {
  mount();
  sidebar();
  await opened();
  await userEvent.click(screen.getByRole('button', { name: 'Canvas' }));
  await closed();
});

it('hands sidebar focus to the next navigation item without restoring the previous item', async () => {
  mount();
  sidebar();
  await opened();
  const next = screen.getByRole('button', { name: 'Right other' });
  next.focus();
  request({ panelKey: 'other', origin: 'secondary-navigation', navigationItemId: 'other' });
  await closed();
  expect(next).toHaveFocus();
});

it('ignores malformed requests and unrelated toolbar requests while an existing sidebar stays open', async () => {
  mount();
  act(() => window.dispatchEvent(new CustomEvent(STUDIO_OPEN_PANEL_EVENT, { detail: null })));
  await closed();
  sidebar();
  await opened();
  request('other');
  expect(screen.getByRole('textbox', { name: 'Layer name' })).toBeVisible();
});

it.each(['hidden', 'missing', undefined])(
  'falls back to the toolbar for unavailable navigation anchor %s',
  async navigationItemId => {
    mount();
    request({ panelKey: 'layers', origin: 'secondary-navigation', navigationItemId });
    await opened();
    expect(screen.getByRole('dialog')).not.toHaveClass('w-80');
    await userEvent.click(screen.getByRole('button', { name: 'Panel action' }));
    await userEvent.keyboard('{Escape}');
    await closed();
  }
);

it('uses a bottom sheet for horizontal navigation and preserves content when placement changes', async () => {
  mount();
  request('layers');
  await opened();
  await userEvent.fill(screen.getByRole('textbox', { name: 'Layer name' }), 'Persistent');
  sidebar('horizontal');
  await opened();
  expect(screen.getByRole('dialog', { name: 'Layers' })).toHaveClass('bottom-0');
  expect(screen.getByRole('textbox', { name: 'Layer name' })).toHaveValue('Persistent');
  await userEvent.click(screen.getByRole('button', { name: 'Panel action' }));
  await userEvent.keyboard('{Escape}');
  await closed();
});

it('opens a large desktop dialog and closes it through its native close button', async () => {
  mount({ large: true, icon: <span>Palette icon</span> });
  await userEvent.click(screen.getByRole('button', { name: 'Layers' }));
  await opened();
  expect(screen.getByRole('dialog', { name: 'Layers' })).toHaveAttribute(
    'data-slot',
    'dialog-content'
  );
  await userEvent.click(screen.getByRole('button', { name: /close|schließen/i }));
  await closed();
});

it('uses a wide sidebar for large panels without turning it into a modal dialog', async () => {
  mount({ large: true });
  sidebar();
  await opened();
  expect(screen.getByRole('dialog', { name: 'Layers' })).toHaveClass(
    'w-[min(56rem,calc(100vw-5rem))]'
  );
  await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
  await closed();
});

it('opens a mobile toolbar sheet and switches back to a desktop popover on viewport changes', async () => {
  await page.viewport(414, 896);
  mount();
  await userEvent.click(screen.getByRole('button', { name: 'Layers' }));
  await opened();
  expect(screen.getByRole('dialog', { name: 'Layers' })).toHaveClass('bottom-0');
  await userEvent.click(screen.getByRole('button', { name: 'Panel action' }));
  await userEvent.keyboard('{Escape}');
  await closed();
  await page.viewport(1280, 800);
  await userEvent.click(screen.getByRole('button', { name: 'Layers' }));
  await opened();
  expect(screen.getByRole('dialog')).not.toHaveClass('bottom-0');
});

it('supports sidebar-only panels while refusing a toolbar request without a toolbar trigger', async () => {
  mount({ toolbarTrigger: false });
  request('layers');
  await closed();
  sidebar();
  await opened();
  expect(screen.queryByRole('button', { name: 'Layers' })).toBeNull();
});

it('notifies the workspace when an open panel is unmounted', async () => {
  const states: boolean[] = [];
  const listener = (event: Event) => states.push((event as CustomEvent<boolean>).detail);
  window.addEventListener('studio-panel', listener);
  try {
    const mounted = mount();
    request('layers');
    await opened();
    mounted.unmount();
    expect(states).toEqual([true, false]);
  } finally {
    window.removeEventListener('studio-panel', listener);
  }
});
