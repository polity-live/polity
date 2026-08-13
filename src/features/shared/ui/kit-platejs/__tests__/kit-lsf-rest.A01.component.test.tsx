/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  blockConfig: undefined as any,
  dndConfig: undefined as any,
  fixedConfig: undefined as any,
  linkConfig: undefined as any,
  suggestionConfig: undefined as any,
  discussionConfig: undefined as any,
  selectors: undefined as any,
  insertMedia: vi.fn(),
  editorSetOption: vi.fn(),
}));

function builder(initial: any) {
  return {
    key: initial.key,
    configure(config: any) {
      if (initial.key === 'discussion') mocks.discussionConfig = config;
      else mocks.fixedConfig = config;
      Object.assign(this, config);
      return this;
    },
    extendSelectors(factory: any) {
      mocks.selectors = factory({
        getOption: (key: string) =>
          key === 'users' ? { alice: { id: 'alice' }, bob: { id: 'bob' } } : 'alice',
      });
      return this;
    },
  };
}

vi.mock('platejs', () => ({
  KEYS: { p: 'p' },
  isSlateEditor: () => false,
  isSlateElement: () => false,
  isSlateString: () => false,
}));
vi.mock('@platejs/suggestion', () => ({ BaseSuggestionPlugin: {} }));
vi.mock('platejs/react', () => ({
  BlockPlaceholderPlugin: {
    configure: (config: any) => {
      mocks.blockConfig = config;
      return config;
    },
  },
  createPlatePlugin: (config: any) => builder(config),
  toTPlatePlugin: (_plugin: unknown, factory: any) => {
    factory({ editor: { getOption: () => 'alice' } });
    return {
      configure: (config: any) => {
        mocks.suggestionConfig = config;
        return config;
      },
    };
  },
  useEditorRef: () => ({ getOptions: () => ({}), setOption: mocks.editorSetOption }),
}));
vi.mock('@platejs/dnd', () => ({
  DndPlugin: {
    configure: (config: any) => {
      mocks.dndConfig = config;
      return config;
    },
  },
}));
vi.mock('@platejs/media/react', () => ({ PlaceholderPlugin: {} }));
vi.mock('react-dnd', () => ({ DndProvider: ({ children }: any) => <>{children}</> }));
vi.mock('react-dnd-html5-backend', () => ({ HTML5Backend: {} }));
vi.mock('@platejs/link', () => ({
  LinkRules: { markdown: (x: any) => x, autolink: (x: any) => x },
}));
vi.mock('@platejs/link/react', () => ({
  LinkPlugin: {
    configure: (config: any) => {
      mocks.linkConfig = config;
      return config;
    },
  },
}));
vi.mock('../autoformat-kit.tsx', () => ({ isAutoformatRuleEnabled: () => true }));
vi.mock('@/features/shared/logic/suggestionBreakCleanupPlugin', () => ({
  SuggestionBreakCleanupPlugin: {},
}));
vi.mock('@/features/shared/logic/suggestionForeignInsertPlugin', () => ({
  SuggestionForeignInsertPlugin: {},
}));
vi.mock('@/features/shared/ui/ui-platejs/block-suggestion.tsx', () => ({
  FilteredBlockSuggestion: () => <div />,
}));
vi.mock('@/features/shared/ui/ui-platejs/suggestion-node.tsx', () => ({
  SuggestionLeaf: () => null,
  SuggestionLineBreak: () => null,
}));
vi.mock('@/features/shared/ui/ui-platejs/fixed-toolbar.tsx', () => ({
  FixedToolbar: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui-platejs/fixed-toolbar-buttons.tsx', () => ({
  FixedToolbarButtons: () => <span>buttons</span>,
}));
vi.mock('@/features/shared/ui/ui-platejs/link-toolbar.tsx', () => ({
  LinkFloatingToolbar: () => <span>link toolbar</span>,
}));
vi.mock('@/features/shared/ui/ui-platejs/link-node.tsx', () => ({ LinkElement: () => null }));
vi.mock('@/features/shared/ui/ui-platejs/block-discussion.tsx', () => ({
  BlockDiscussion: () => null,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@platejs/ai/react', () => ({ CopilotPlugin: {} }));
vi.mock('../SettingsDialogView', () => ({
  SettingsDialogView: (props: any) => <div>{props.renderApiKeyInput('openai', 'OpenAI')}</div>,
}));

import { BlockPlaceholderKit } from '../block-placeholder-kit';
import { discussionPlugin } from '../discussion-kit';
import { DndKit } from '../dnd-kit';
import { LinkKit } from '../link-kit';
import { SettingsDialog } from '../settings-dialog';
import {
  SuggestionCallbacksProvider,
  useSuggestionCallbacks,
} from '../suggestion-callbacks-context';
import { suggestionPlugin } from '../suggestion-kit';

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('remaining Plate kit callbacks', () => {
  it('invokes placeholder, dnd, fixed-toolbar, link, discussion and suggestion callbacks', () => {
    expect(BlockPlaceholderKit).toHaveLength(1);
    expect(mocks.blockConfig.options.query({ path: [0] })).toBe(true);
    expect(mocks.blockConfig.options.query({ path: [0, 1] })).toBe(false);

    const editor = { getTransforms: () => ({ insert: { media: mocks.insertMedia } }) };
    const dndConfig = DndKit[0] as any;
    const linkConfig = LinkKit[0] as any;
    dndConfig.options.onDropFiles({ dragItem: { files: ['file'] }, editor, target: [0] });
    render(dndConfig.render.aboveSlate({ children: <span>dnd</span> }));
    render(linkConfig.render.afterEditable());
    expect(mocks.insertMedia).toHaveBeenCalledOnce();

    expect(discussionPlugin).toBeTruthy();
    expect(mocks.selectors.currentUser()).toEqual({ id: 'alice' });
    expect(mocks.selectors.user('bob')).toEqual({ id: 'bob' });
    expect(suggestionPlugin).toBeTruthy();
  });

  it('provides callbacks and runs settings key state updater closures', () => {
    const callbacks = { onVoteAccept: vi.fn() };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SuggestionCallbacksProvider callbacks={callbacks}>{children}</SuggestionCallbacksProvider>
    );
    expect(renderHook(() => useSuggestionCallbacks(), { wrapper }).result.current).toBe(callbacks);

    render(<SettingsDialog />);
    const input = screen.getByLabelText('OpenAI');
    fireEvent.change(input, { target: { value: 'key' } });
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons.at(-1)!);
    expect(input).toBeTruthy();
  });
});
