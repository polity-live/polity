/* @vitest-environment jsdom */
import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { Toolbar } from '@/features/shared/ui/layout';
import { EditingModeToolbarButton } from '../EditingModeToolbarButton';
import type { SelectableEditingMode } from '../EditingMode';
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
afterEach(cleanup);

it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  'opens and changes editing mode with native keyboard in standalone=%s label=%s',
  async (standalone, showLabel) => {
    const changed = vi.fn();
    function View() {
      const [mode, setMode] = useState<SelectableEditingMode>('view');
      return (
        <Toolbar>
          <EditingModeToolbarButton
            data-action-id="shared.editing-mode.menu.open"
            mode={mode}
            standalone={standalone}
            showLabel={showLabel}
            canChangeMode
            availableModes={['view', 'edit']}
            disabledModeReasons={{}}
            onModeChange={next => {
              changed(next);
              setMode(next);
            }}
          />
        </Toolbar>
      );
    }
    render(<View />);
    const button = screen.getByRole('button', { name: 'Viewing' });
    expect(button.getAttribute('data-action-id')).toBe('shared.editing-mode.menu.open');
    expect(screen.queryByRole('menu')).toBeNull();
    button.focus();
    expect(document.activeElement).toBe(button);
    const user = userEvent.setup();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    expect(
      screen.getByRole('menuitemradio', { name: /Viewing/ }).getAttribute('aria-checked')
    ).toBe('true');
    const edit = screen.getByRole('menuitemradio', { name: /Collaborative Editing/ });
    edit.focus();
    await user.keyboard('{Enter}');
    expect(changed).toHaveBeenCalledExactlyOnceWith('edit');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    const updated = screen.getByRole('button', { name: 'Collaborative Editing' });
    expect(document.activeElement).toBe(updated);
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(updated);
  }
);
it('keeps the mode menu accessible in view-only mode and prevents unauthorized changes', async () => {
  const changed = vi.fn();
  render(
    <Toolbar>
      <EditingModeToolbarButton
        data-action-id="shared.editing-mode.menu.open"
        mode="view"
        canChangeMode={false}
        disabledModeReasons={{ edit: 'branch-readonly' }}
        onModeChange={changed}
      />
    </Toolbar>
  );
  const button = screen.getByRole('button', { name: 'Viewing' });
  button.focus();
  const user = userEvent.setup();
  await user.keyboard('{Enter}');
  expect(await screen.findByText('plateJs.toolbar.mode.viewOnly')).toBeTruthy();
  for (const item of screen.getAllByRole('menuitemradio')) {
    expect(item.getAttribute('aria-disabled')).toBe('true');
    await user.click(item);
  }
  expect(changed).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(document.activeElement).toBe(button);
});
