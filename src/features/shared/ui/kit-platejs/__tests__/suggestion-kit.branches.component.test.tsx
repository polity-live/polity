/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseConfig: null as any,
  blockAccessibilityConfig: null as any,
  blockConfigFactory: null as any,
  config: null as any,
  isSlateEditor: vi.fn(),
  isSlateElement: vi.fn(),
  isSlateString: vi.fn(),
  shadowInputRef: { current: null as HTMLInputElement | null },
}));

vi.mock('platejs', () => ({
  KEYS: { codeLine: 'code-line', column: 'column', table: 'table', td: 'td' },
  getPluginTypes: () => ['column', 'code-line', 'table', 'td'],
  isSlateEditor: mocks.isSlateEditor,
  isSlateElement: mocks.isSlateElement,
  isSlateString: mocks.isSlateString,
}));
vi.mock('platejs/react', () => ({
  createPlatePlugin: (config: any) => {
    mocks.blockAccessibilityConfig = config;
    return config;
  },
  toTPlatePlugin: () => ({
    configure: (config: any) => {
      mocks.config = config;
      return config;
    },
  }),
  usePluginOption: () => mocks.shadowInputRef,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@platejs/suggestion', () => ({
  BaseSuggestionPlugin: {
    configure: (config: any) => {
      mocks.baseConfig = config;
      return config;
    },
  },
}));
vi.mock('@platejs/selection/react', () => ({
  BlockSelectionPlugin: {
    configure: (factory: any) => {
      mocks.blockConfigFactory = factory;
      return factory;
    },
  },
}));
vi.mock('@/features/shared/ui/ui-platejs/block-suggestion.tsx', () => ({
  FilteredBlockSuggestion: () => <div>filtered block</div>,
}));
vi.mock('@/features/shared/ui/ui-platejs/suggestion-node.tsx', () => ({
  SuggestionLeaf: () => null,
  SuggestionLineBreak: () => null,
}));
vi.mock('@/features/shared/ui/ui-platejs/suggestion-node-static.tsx', () => ({
  BlockSuggestionStatic: () => <div>static block</div>,
  SuggestionLeafStatic: () => null,
  SuggestionLineBreakStatic: () => <div>line break</div>,
}));
vi.mock('@/features/shared/ui/ui-platejs/block-selection.tsx', () => ({
  BlockSelection: () => <div>selection</div>,
}));
vi.mock('../discussion-kit.tsx', () => ({ discussionPlugin: {} }));
vi.mock('@/features/shared/logic/suggestionBreakCleanupPlugin', () => ({
  SuggestionBreakCleanupPlugin: {},
}));
vi.mock('@/features/shared/logic/suggestionForeignInsertPlugin', () => ({
  SuggestionForeignInsertPlugin: {},
}));

await import('../suggestion-kit');
await import('../suggestion-base-kit');
await import('../block-selection-kit');

describe('suggestion kit branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSlateString.mockReturnValue(true);
    mocks.isSlateElement.mockReturnValue(false);
    mocks.isSlateEditor.mockReturnValue(false);
  });

  function clickTarget({
    className = '',
    id = 'suggestion-1' as string | undefined,
    parent = true,
    suggestionEntry = [{}] as any,
  } = {}) {
    const parentElement = parent ? document.createElement('div') : null;
    const leaf = document.createElement('span');
    leaf.className = className;
    if (parentElement) parentElement.appendChild(leaf);
    const setOption = vi.fn();
    mocks.config.handlers.onClick({
      api: {
        suggestion: {
          node: () => suggestionEntry,
          nodeId: () => id,
        },
      },
      event: { target: leaf },
      setOption,
      type: 'suggestion',
    });
    return setOption;
  }

  it('unsets non-slate and unmatched click targets', () => {
    mocks.isSlateString.mockReturnValue(false);
    expect(clickTarget({ parent: false })).toHaveBeenCalledWith('activeId', null);

    mocks.isSlateString.mockReturnValue(true);
    expect(clickTarget()).toHaveBeenCalledWith('activeId', null);
  });

  it('stops traversal at Slate element and editor boundaries', () => {
    mocks.isSlateElement.mockReturnValue(true);
    expect(clickTarget()).toHaveBeenCalledWith('activeId', null);
    mocks.isSlateElement.mockReturnValue(false);
    mocks.isSlateEditor.mockReturnValue(true);
    expect(clickTarget()).toHaveBeenCalledWith('activeId', null);
  });

  it('handles missing suggestions and present ids including null fallback', () => {
    expect(
      clickTarget({ className: 'slate-suggestion', suggestionEntry: null })
    ).toHaveBeenCalledWith('activeId', null);
    expect(clickTarget({ className: 'slate-suggestion' })).toHaveBeenCalledWith(
      'activeId',
      'suggestion-1'
    );
    expect(clickTarget({ className: 'slate-suggestion', id: null as any })).toHaveBeenCalledWith(
      'activeId',
      null
    );
  });

  it('renders block suggestions only for matching elements', () => {
    const belowRoot = mocks.config.render.belowRootNodes;
    expect(
      belowRoot({ api: { suggestion: { isBlockSuggestion: () => false } }, element: {} })
    ).toBeNull();
    render(belowRoot({ api: { suggestion: { isBlockSuggestion: () => true } }, element: {} }));
    expect(screen.getByText('filtered block')).toBeTruthy();
  });
});

describe('suggestion base kit branches', () => {
  it('handles non-block, non-line-break, and line-break suggestions', () => {
    const belowNodes = mocks.baseConfig.render.belowNodes;
    expect(
      belowNodes({ api: { suggestion: { isBlockSuggestion: () => false } }, element: {} })
    ).toBeUndefined();
    expect(
      belowNodes({
        api: { suggestion: { isBlockSuggestion: () => true } },
        element: { suggestion: {} },
      })
    ).toBeUndefined();
    const Component = belowNodes({
      api: { suggestion: { isBlockSuggestion: () => true } },
      element: { suggestion: { isLineBreak: true } },
    });
    render(<Component>Child</Component>);
    expect(screen.getByText('line break')).toBeTruthy();
  });

  it('renders root blocks only for block suggestions', () => {
    const belowRoot = mocks.baseConfig.render.belowRootNodes;
    expect(
      belowRoot({ api: { suggestion: { isBlockSuggestion: () => false } }, element: {} })
    ).toBeUndefined();
    render(belowRoot({ api: { suggestion: { isBlockSuggestion: () => true } }, element: {} }));
    expect(screen.getByText('static block')).toBeTruthy();
  });
});

describe('block selection kit branches', () => {
  it('filters nested plugin types and conditionally renders selection UI', () => {
    const config = mocks.blockConfigFactory({ editor: {} });
    expect(config.options.isSelectable({ type: 'column' })).toBe(false);
    expect(config.options.isSelectable({ type: 'paragraph' })).toBe(true);
    expect(config.render.belowRootNodes({ attributes: {} })).toBeNull();
    render(config.render.belowRootNodes({ attributes: { className: 'slate-selectable' } }));
    expect(screen.getByText('selection')).toBeTruthy();
  });

  it('labels the off-screen block-selection keyboard input when Plate portals it', async () => {
    mocks.shadowInputRef.current = null;
    const Accessibility = mocks.blockAccessibilityConfig.render.afterEditable;
    const view = render(<Accessibility />);
    const shadowInput = document.createElement('input');
    shadowInput.className = 'slate-shadow-input';
    mocks.shadowInputRef.current = shadowInput;
    document.body.appendChild(shadowInput);

    await waitFor(() => {
      expect(shadowInput.getAttribute('aria-label')).toBe('plateJs.toolbar.blockSelectionInput');
    });

    view.unmount();
    shadowInput.remove();
    mocks.shadowInputRef.current = null;
  });
});
