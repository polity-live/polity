/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  nodeId: undefined as string | undefined,
  dataList: [] as any[],
  activeId: undefined as string | undefined,
  hoverId: undefined as string | undefined,
  discussions: undefined as any[] | undefined,
  selectedCrIds: null as Set<string> | null,
  setOption: vi.fn(),
}));

vi.mock('platejs/react', () => ({
  PlateLeaf: ({ as = 'span', children, attributes, ...props }: any) =>
    React.createElement(as, { ...attributes, className: props.className }, children),
  useEditorPlugin: () => ({
    api: {
      suggestion: {
        nodeId: () => state.nodeId,
        dataList: () => state.dataList,
      },
    },
    setOption: (...args: unknown[]) => state.setOption(...args),
  }),
  usePluginOption: (plugin: { key: string }, option: string) => {
    if (plugin.key === 'discussion') return state.discussions;
    return option === 'activeId' ? state.activeId : state.hoverId;
  },
}));
vi.mock('platejs/static', () => ({
  SlateLeaf: ({ as = 'span', children, ...props }: any) =>
    React.createElement(as, { className: props.className }, children),
}));
vi.mock('@platejs/suggestion', () => ({ BaseSuggestionPlugin: { key: 'suggestion' } }));
vi.mock('@/features/shared/ui/kit-platejs/suggestion-kit.tsx', () => ({
  suggestionPlugin: { key: 'suggestion' },
}));
vi.mock('@/features/shared/ui/kit-platejs/discussion-kit.tsx', () => ({
  discussionPlugin: { key: 'discussion' },
}));
vi.mock('@/features/shared/ui/kit-platejs/mode-context.tsx', () => ({
  useModeContext: () => ({ selectedCrIds: state.selectedCrIds }),
}));
vi.mock('@/features/shared/theme', () => ({
  getMotionPreset: () => 'motion',
  getSemanticToneClasses: (tone: string) => ({
    surface: `${tone}-surface`,
    ring: `${tone}-ring`,
    border: `${tone}-border`,
  }),
}));

import {
  BlockSuggestionStatic,
  SuggestionLeafStatic,
  SuggestionLineBreakStatic,
} from '../suggestion-node-static';
import { SuggestionLeaf, SuggestionLineBreak } from '../suggestion-node';

beforeEach(() => {
  vi.clearAllMocks();
  state.nodeId = undefined;
  state.dataList = [];
  state.activeId = undefined;
  state.hoverId = undefined;
  state.discussions = undefined;
  state.selectedCrIds = null;
});

afterEach(cleanup);

const leafProps = {
  leaf: { text: 'change' },
  text: { text: 'change' },
  attributes: {},
  children: 'change',
} as any;

describe('SuggestionLeaf', () => {
  it('hides filtered inserts and shows filtered removals without decoration', () => {
    state.nodeId = 'suggestion';
    state.discussions = [{ id: 'suggestion', crId: 'CR-1' }];
    state.selectedCrIds = new Set(['CR-2']);
    state.dataList = [{ id: 'suggestion', type: 'insert' }];
    const view = render(<SuggestionLeaf {...leafProps} />);
    expect(view.container.firstElementChild?.className).toBe('hidden');

    state.dataList = [{ id: 'suggestion', type: 'remove' }];
    view.rerender(<SuggestionLeaf {...leafProps} />);
    expect(view.container.firstElementChild?.className).toBe('');
  });

  it('decorates active, hovered, removed and unidentified leaves and publishes hover state', () => {
    state.nodeId = 'suggestion';
    state.discussions = [{ id: 'suggestion', crId: 'CR-1' }];
    state.selectedCrIds = new Set(['CR-1']);
    state.dataList = [{ id: 'suggestion', type: 'insert' }];
    state.activeId = 'suggestion';
    const view = render(<SuggestionLeaf {...leafProps} />);
    expect(view.container.firstElementChild?.className).toContain('success-ring');
    expect(view.container.firstElementChild?.getAttribute('data-suggestion-type')).toBe('insert');
    fireEvent.mouseEnter(view.container.firstElementChild as Element);
    fireEvent.mouseLeave(view.container.firstElementChild as Element);
    expect(state.setOption).toHaveBeenNthCalledWith(1, 'hoverId', 'suggestion');
    expect(state.setOption).toHaveBeenNthCalledWith(2, 'hoverId', null);

    state.activeId = undefined;
    state.hoverId = 'suggestion';
    state.dataList = [{ id: 'suggestion', type: 'remove' }];
    view.rerender(<SuggestionLeaf {...leafProps} />);
    expect(view.container.firstElementChild?.className).toContain('danger-ring');
    expect(view.container.firstElementChild?.getAttribute('data-suggestion-type')).toBe('remove');

    state.nodeId = undefined;
    state.hoverId = undefined;
    state.discussions = undefined;
    state.selectedCrIds = null;
    state.dataList = [];
    view.rerender(<SuggestionLeaf {...leafProps} />);
    expect(view.container.firstElementChild?.hasAttribute('data-suggestion-id')).toBe(false);
  });
});

describe('SuggestionLineBreak', () => {
  const api = { suggestion: { isBlockSuggestion: vi.fn() } };

  it('rejects non-block and non-line-break elements', () => {
    api.suggestion.isBlockSuggestion.mockReturnValue(false);
    expect(SuggestionLineBreak({ api, element: {} } as never)).toBeUndefined();
    api.suggestion.isBlockSuggestion.mockReturnValue(true);
    expect(
      SuggestionLineBreak({ api, element: { suggestion: undefined } } as never)
    ).toBeUndefined();
    expect(
      SuggestionLineBreak({
        api,
        element: { suggestion: { id: 'id', isLineBreak: false } },
      } as never)
    ).toBeUndefined();
  });

  it('renders insert/remove states, activity variants, and CR filtering', () => {
    api.suggestion.isBlockSuggestion.mockReturnValue(true);
    const insert = { id: 'line', type: 'insert', isLineBreak: true };
    const InsertComponent = SuggestionLineBreak({
      api,
      element: { suggestion: insert },
    } as never)! as React.ComponentType<React.PropsWithChildren>;
    state.activeId = 'line';
    let view = render(
      <InsertComponent>
        <span>child</span>
      </InsertComponent>
    );
    expect(view.container.querySelector('span.absolute')?.className).toContain('success-ring');
    view.unmount();

    state.activeId = undefined;
    state.hoverId = 'line';
    view = render(
      <InsertComponent>
        <span>child</span>
      </InsertComponent>
    );
    expect(view.container.querySelector('span.absolute')?.className).toContain('success-ring');
    view.unmount();

    const remove = { id: 'line', type: 'remove', isLineBreak: true };
    const RemoveComponent = SuggestionLineBreak({
      api,
      element: { suggestion: remove },
    } as never)! as React.ComponentType<React.PropsWithChildren>;
    view = render(
      <RemoveComponent>
        <span>child</span>
      </RemoveComponent>
    );
    expect(view.container.querySelector('span.absolute')?.className).toContain('danger-ring');
    view.unmount();

    state.hoverId = undefined;
    state.discussions = [{ id: 'line', crId: 'CR-1' }];
    state.selectedCrIds = new Set(['CR-2']);
    view = render(
      <InsertComponent>
        <span>child</span>
      </InsertComponent>
    );
    expect(view.container.querySelector('span.absolute')).toBeNull();
  });
});

describe('static suggestion nodes', () => {
  const editor = {
    getApi: () => ({ suggestion: { dataList: () => state.dataList } }),
  };

  it('renders inserted and removed leaves', () => {
    state.dataList = [{ type: 'insert' }];
    const view = render(<SuggestionLeafStatic {...({ ...leafProps, editor } as any)} />);
    expect(view.container.querySelector('ins')).toBeTruthy();
    state.dataList = [{ type: 'remove' }];
    view.rerender(<SuggestionLeafStatic {...({ ...leafProps, editor } as any)} />);
    expect(view.container.querySelector('del')?.className).toContain('danger-surface');
  });

  it('handles absent, line-break, insert and remove block suggestion metadata', () => {
    const view = render(<BlockSuggestionStatic element={{} as never} />);
    expect(view.container.firstElementChild?.className).toContain('success-border');
    view.rerender(
      <BlockSuggestionStatic element={{ suggestion: { isLineBreak: true } } as never} />
    );
    expect(view.container.firstElementChild).toBeNull();
    view.rerender(<BlockSuggestionStatic element={{ suggestion: { type: 'remove' } } as never} />);
    expect(view.container.firstElementChild?.className).toContain('danger-border');
  });

  it.each(['insert', 'remove', 'update'])('renders %s line-break styling', type => {
    const { container } = render(
      <SuggestionLineBreakStatic suggestionData={{ id: type, type } as never} />
    );
    const className = container.firstElementChild?.className ?? '';
    if (type === 'insert') expect(className).toContain('success-surface');
    if (type === 'remove') expect(className).toContain('danger-surface');
    if (type === 'update') expect(className).not.toContain('surface');
  });
});
