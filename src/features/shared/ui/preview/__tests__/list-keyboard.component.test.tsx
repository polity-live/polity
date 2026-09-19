/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleWorkspaceListKeyDown } from '../list-keyboard';

afterEach(cleanup);
describe('workspace list keyboard', () => {
  it('keeps unrelated controls and boundary keys local even without optional row wrappers', () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <div onKeyDown={handleWorkspaceListKeyDown}>
          <button>Unrelated</button>
          <a href="/event/one" data-workspace-open>
            One
          </a>
          <a href="/event/two" data-workspace-open>
            Two
          </a>
        </div>
      </div>
    );
    const one = screen.getByRole('link', { name: 'One' }),
      two = screen.getByRole('link', { name: 'Two' });
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    expect(outer).toHaveBeenCalledOnce();
    outer.mockClear();
    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(one);
    fireEvent.keyDown(one, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(two);
    fireEvent.keyDown(two, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(two);
    fireEvent.keyDown(two, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(one);
    expect(outer).not.toHaveBeenCalled();
    fireEvent.keyDown(one, { key: 'Enter' });
    fireEvent.keyDown(one, { key: ' ' });
    expect(outer).toHaveBeenCalledTimes(2);
  });
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
