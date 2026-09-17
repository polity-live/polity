/* @vitest-environment jsdom */
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateStepRendererView } from '../CreateStepRendererView';
import { focusCreateSection } from '../../logic/createFormFocus';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(cleanup);

function Draft() {
  const [value, setValue] = useState('');
  return (
    <input
      aria-label="Optional notes"
      value={value}
      onChange={event => setValue(event.target.value)}
    />
  );
}

describe('optional create sections', () => {
  it('keeps visibility exposed and preserves optional inputs when details are closed', () => {
    const { container } = render(
      <CreateStepRendererView
        compactOptional
        step={{
          label: 'Settings',
          optional: true,
          isValid: () => true,
          fields: [
            {
              key: 'visibility',
              kind: 'custom',
              alwaysVisible: true,
              node: <button>Private</button>,
            },
            { key: 'notes', kind: 'customComponent', component: Draft },
          ],
        }}
      />
    );
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(screen.getByText('Private').closest('details')).toBeNull();
    details.open = true;
    const notes = screen.getByLabelText('Optional notes');
    fireEvent.change(notes, { target: { value: 'Keep this draft' } });
    details.open = false;
    details.open = true;
    expect(screen.getByLabelText('Optional notes')).toBe(notes);
    expect((notes as HTMLInputElement).value).toBe('Keep this draft');
  });

  it('opens invalid optional sections and focuses their first editable invalid control', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 1;
    });
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = render(
      <div data-create-flow="todo">
        <div data-create-section>
          <input aria-label="Valid" />
        </div>
        <div data-create-section>
          <details>
            <summary>More</summary>
            <div aria-invalid="true">
              <input aria-label="Invalid date" />
            </div>
          </details>
        </div>
      </div>
    );
    act(() => focusCreateSection(container.firstElementChild as HTMLElement, 1));
    expect(container.querySelector('details')?.open).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText('Invalid date'));
    vi.restoreAllMocks();
  });
});
