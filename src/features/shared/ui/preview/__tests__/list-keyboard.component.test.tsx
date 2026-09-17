/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleWorkspaceListKeyDown } from '../list-keyboard';

afterEach(cleanup);
describe('workspace list keyboard', () => {
  it('moves between rows and opens the explicitly focused preview with Space', () => {
    const preview = vi.fn();
    render(
      <div data-workspace-list onKeyDown={handleWorkspaceListKeyDown}>
        <div data-workspace-row>
          <a href="/event/one" data-workspace-open>
            One
          </a>
          <button data-workspace-preview-button onClick={preview}>
            Preview one
          </button>
        </div>
        <div data-workspace-row>
          <a href="/event/two" data-workspace-open>
            Two
          </a>
          <input aria-label="Edit title" />
        </div>
      </div>
    );
    const one = screen.getByRole('link', { name: 'One' });
    one.focus();
    fireEvent.keyDown(one, { key: ' ' });
    expect(preview).toHaveBeenCalledOnce();
    fireEvent.keyDown(one, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Two' }));
    const input = screen.getByLabelText('Edit title');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(one, { key: ' ', ctrlKey: true });
    expect(preview).toHaveBeenCalledOnce();
  });
});
