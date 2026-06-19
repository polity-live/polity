/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toolbar } from '@/features/shared/ui/layout';
import { AIToolbarButton } from '../ai-toolbar-button';

const mocks = vi.hoisted(() => ({
  block: vi.fn(),
  blockSelectionSet: vi.fn(),
  blocks: vi.fn(),
  focus: vi.fn(),
  getOption: vi.fn(),
  isExpanded: vi.fn(),
  select: vi.fn(),
  show: vi.fn(),
  useEditorPlugin: vi.fn(),
}));

vi.mock('@platejs/ai/react', () => ({
  AIChatPlugin: { key: 'aiChat' },
}));

vi.mock('@platejs/selection/react', () => ({
  BlockSelectionPlugin: { key: 'blockSelection' },
}));

vi.mock('platejs/react', () => ({
  useEditorPlugin: mocks.useEditorPlugin,
}));

describe('AIToolbarButton', () => {
  function renderButton({
    currentBlockId = 'block-1',
    currentBlockPath = [0],
    isExpanded = false,
    isBlockSelecting = false,
    lastBlockId = 'last-block',
    lastBlockPath = [1],
    selection = { anchor: {}, focus: {} },
  }: {
    currentBlockId?: string | null;
    currentBlockPath?: number[];
    isExpanded?: boolean;
    isBlockSelecting?: boolean;
    lastBlockId?: string | null;
    lastBlockPath?: number[];
    selection?: unknown;
  } = {}) {
    mocks.getOption.mockReturnValue(isBlockSelecting);
    mocks.isExpanded.mockReturnValue(isExpanded);
    mocks.block.mockReturnValue(currentBlockId ? [{ id: currentBlockId }, currentBlockPath] : null);
    mocks.blocks.mockReturnValue(lastBlockId ? [[{ id: lastBlockId }, lastBlockPath]] : []);
    mocks.useEditorPlugin.mockReturnValue({
      api: {
        aiChat: {
          show: mocks.show,
        },
      },
      editor: {
        api: {
          block: mocks.block,
          blocks: mocks.blocks,
          isExpanded: mocks.isExpanded,
        },
        getApi: () => ({
          blockSelection: {
            set: mocks.blockSelectionSet,
          },
        }),
        getOption: mocks.getOption,
        selection,
        tf: {
          focus: mocks.focus,
          select: mocks.select,
        },
      },
    });

    return render(
      <Toolbar>
        <AIToolbarButton>KI Befehle</AIToolbarButton>
      </Toolbar>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens AI commands without refocusing or changing an active block selection', () => {
    const { getByRole } = renderButton({
      isBlockSelecting: true,
      selection: { anchor: {}, focus: {} },
    });

    fireEvent.click(getByRole('button'));

    expect(mocks.focus).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.blockSelectionSet).not.toHaveBeenCalled();
    expect(mocks.show).toHaveBeenCalledTimes(1);
  });

  it('focuses the editor and opens AI commands without block selection when text is selected', () => {
    const { getByRole } = renderButton({
      isExpanded: true,
      selection: { anchor: {}, focus: {} },
    });

    fireEvent.click(getByRole('button'));

    expect(mocks.focus).toHaveBeenCalledTimes(1);
    expect(mocks.focus).toHaveBeenCalledWith();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.blockSelectionSet).not.toHaveBeenCalled();
    expect(mocks.show).toHaveBeenCalledTimes(1);
  });

  it('selects the current block before opening AI commands when selection is collapsed', () => {
    const { getByRole } = renderButton({
      selection: { anchor: {}, focus: {} },
    });

    fireEvent.click(getByRole('button'));

    expect(mocks.focus).toHaveBeenCalledTimes(1);
    expect(mocks.focus).toHaveBeenCalledWith();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.blockSelectionSet).toHaveBeenCalledTimes(1);
    expect(mocks.blockSelectionSet).toHaveBeenCalledWith('block-1');
    expect(mocks.show).toHaveBeenCalledTimes(1);
  });

  it('selects and focuses the last block before opening AI commands when no selection exists', () => {
    const { getByRole } = renderButton({
      currentBlockId: null,
      lastBlockId: 'block-2',
      lastBlockPath: [2],
      selection: null,
    });

    fireEvent.click(getByRole('button'));

    expect(mocks.focus).toHaveBeenCalledTimes(1);
    expect(mocks.focus).toHaveBeenCalledWith();
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.select).toHaveBeenCalledWith([2], { edge: 'end' });
    expect(mocks.blockSelectionSet).toHaveBeenCalledTimes(1);
    expect(mocks.blockSelectionSet).toHaveBeenCalledWith('block-2');
    expect(mocks.show).toHaveBeenCalledTimes(1);
  });

  it('falls back to end-editor focus when no block can be selected', () => {
    const { getByRole } = renderButton({
      currentBlockId: null,
      lastBlockId: null,
      selection: null,
    });

    expect(() => fireEvent.click(getByRole('button'))).not.toThrow();

    expect(mocks.focus).toHaveBeenCalledTimes(1);
    expect(mocks.focus).toHaveBeenCalledWith({ edge: 'endEditor' });
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.blockSelectionSet).not.toHaveBeenCalled();
    expect(mocks.show).toHaveBeenCalledTimes(1);
  });

  it('prevents toolbar mouse down from stealing editor focus', () => {
    const { getByRole } = renderButton();

    const mouseDown = fireEvent.mouseDown(getByRole('button'));

    expect(mouseDown).toBe(false);
  });
});
