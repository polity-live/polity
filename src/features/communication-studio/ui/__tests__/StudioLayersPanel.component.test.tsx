/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFrameNode, createStudioDocumentV3 } from '../../logic/document-v3';
import { StudioLayersPanel } from '../StudioLayersPanel';

afterEach(cleanup);

function setup() {
  const document = createStudioDocumentV3('Campaign');
  document.nodes.push(
    createFrameNode('square', { name: 'First' }),
    createFrameNode('square', { name: 'Second', zIndex: 1 })
  );
  const props = {
    document,
    selectedNodeIds: [] as string[],
    disabled: false,
    tr: (key: string) => key,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onSetVisibility: vi.fn(),
    onSetLocked: vi.fn(),
    onMove: vi.fn(),
  };
  const view = render(<StudioLayersPanel {...props} />);
  return { props, ...view };
}

const nameInput = () =>
  screen.getByRole('textbox', { name: 'layerName: First' }) as HTMLInputElement;
const start = () => fireEvent.click(screen.getByRole('button', { name: 'rename: First' }));

describe('Studio layer renaming', () => {
  it('selects the layer, focuses and selects its name, and commits once on Enter plus blur', () => {
    const { props } = setup();
    fireEvent.doubleClick(screen.getByRole('button', { name: 'First' }));
    const input = nameInput();
    expect(props.onSelect).toHaveBeenCalledWith(
      props.document.nodes[0],
      props.document.nodes[0].id
    );
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5]);
    expect(input.closest('[role="treeitem"]')?.getAttribute('draggable')).toBe('false');
    fireEvent.change(input, { target: { value: '  Renamed frame  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(props.onRename.mock.calls).toEqual([[props.document.nodes[0].id, 'Renamed frame']]);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'rename: First' }));
  });

  it('commits on blur and allows an existing layer name', () => {
    const { props } = setup();
    start();
    fireEvent.change(nameInput(), { target: { value: 'Second' } });
    fireEvent.blur(nameInput());
    expect(props.onRename).toHaveBeenCalledWith(props.document.nodes[0].id, 'Second');
  });

  it.each(['Escape', 'unchanged', 'empty-blur'])(
    'does not commit %s and restores the name button',
    reason => {
      const { props } = setup();
      start();
      const input = nameInput();
      fireEvent.change(input, {
        target: {
          value: reason === 'unchanged' ? ' First ' : reason === 'Escape' ? 'Discard' : '   ',
        },
      });
      if (reason === 'empty-blur') fireEvent.blur(input);
      else fireEvent.keyDown(input, { key: reason === 'Escape' ? 'Escape' : 'Enter' });
      expect(props.onRename).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.getByRole('button', { name: 'First' })).toBeTruthy();
    }
  );

  it('shows an accessible validation error and accepts a corrected name', () => {
    const { props } = setup();
    start();
    fireEvent.change(nameInput(), { target: { value: '   ' } });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe('layerNameRequired');
    expect(nameInput().getAttribute('aria-invalid')).toBe('true');
    expect(nameInput().getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect(props.onRename).not.toHaveBeenCalled();
    fireEvent.change(nameInput(), { target: { value: 'Valid' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith(props.document.nodes[0].id, 'Valid');
  });

  it.each([200, 201])('enforces the name limit for %i characters', length => {
    const { props } = setup();
    start();
    expect(nameInput().maxLength).toBe(200);
    fireEvent.change(nameInput(), { target: { value: 'x'.repeat(length) } });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledTimes(length === 200 ? 1 : 0);
    if (length === 201) expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('ignores Enter during IME composition', () => {
    const { props } = setup();
    start();
    fireEvent.change(nameInput(), { target: { value: '新しい名前' } });
    fireEvent.keyDown(nameInput(), { key: 'Enter', isComposing: true });
    expect(props.onRename).not.toHaveBeenCalled();
    expect(nameInput()).toBeTruthy();
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledOnce();
  });

  it('keeps only one editor when switching layers', () => {
    const { props } = setup();
    start();
    fireEvent.change(nameInput(), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'rename: Second' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'layerName: Second' })).toBe(document.activeElement);
    expect(props.onRename).toHaveBeenCalledWith(props.document.nodes[0].id, 'Updated');
  });

  it.each(['locked', 'read-only'])('prevents renaming a %s layer', mode => {
    const { props, rerender } = setup();
    const next = structuredClone(props.document);
    next.nodes[0].locked = mode === 'locked';
    rerender(<StudioLayersPanel {...props} document={next} disabled={mode === 'read-only'} />);
    expect(
      (screen.getByRole('button', { name: 'rename: First' }) as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.doubleClick(screen.getByRole('button', { name: 'First' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it.each(['deleted', 'locked', 'read-only', 'renamed'])(
    'discards the draft when the layer is %s during editing',
    mode => {
      const { props, rerender } = setup();
      start();
      const input = nameInput();
      fireEvent.change(input, { target: { value: 'Local draft' } });
      const next = structuredClone(props.document);
      if (mode === 'deleted') next.nodes.shift();
      if (mode === 'locked') next.nodes[0].locked = true;
      if (mode === 'renamed') next.nodes[0].name = 'Remote name';
      rerender(<StudioLayersPanel {...props} document={next} disabled={mode === 'read-only'} />);
      fireEvent.blur(input);
      expect(props.onRename).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).toBeNull();
      if (mode === 'renamed') {
        expect(screen.getByRole('status').textContent).toBe('layerRenamedElsewhere');
        expect(screen.getByRole('button', { name: 'Remote name' })).toBeTruthy();
      }
    }
  );

  it('retains the draft across unrelated document updates and preserves row actions', () => {
    const { props, rerender } = setup();
    start();
    fireEvent.change(nameInput(), { target: { value: 'New name' } });
    const next = structuredClone(props.document);
    next.nodes[1].name = 'Other change';
    rerender(<StudioLayersPanel {...props} document={next} />);
    expect(nameInput().value).toBe('New name');
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    next.nodes[0].name = 'New name';
    rerender(<StudioLayersPanel {...props} document={structuredClone(next)} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'New name' } });
    const row = screen.getByRole('treeitem');
    expect(row.getAttribute('data-studio-layer-id')).toBe(props.document.nodes[0].id);
    fireEvent.click(within(row).getByRole('button', { name: 'hide: New name' }));
    fireEvent.click(within(row).getByRole('button', { name: 'lock: New name' }));
    expect(props.onSetVisibility).toHaveBeenCalledWith(next.nodes[0], false);
    expect(props.onSetLocked).toHaveBeenCalledWith(next.nodes[0], true);
  });
});
