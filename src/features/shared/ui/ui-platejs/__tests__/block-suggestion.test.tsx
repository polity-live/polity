/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { TElement } from 'platejs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const translationMock = vi.hoisted(() => ({
  'plateJs.blockSuggestion.block': 'Block',
  'plateJs.dataView.chart': 'Chart',
  'plateJs.dataView.insertTitle': 'Insert data',
  'plateJs.dataView.stat': 'Metric',
  'plateJs.dataView.table': 'Table',
}));

const suggestionCallbacksMock = vi.hoisted(() => ({
  onEventSuggestionCancel: vi.fn(),
  onEventSuggestionConfirm: vi.fn(),
  onFinalizeInternalVote: vi.fn(),
  onSuggestionAccepted: vi.fn(),
  onSuggestionDeclined: vi.fn(),
  onVoteAbstain: vi.fn(),
  onVoteAccept: vi.fn(),
  onVoteReject: vi.fn(),
}));

const modeContextMock = vi.hoisted(() => ({
  currentMode: 'vote_internal',
  isOwnerOrCollaborator: true,
}));

const plateReactMock = vi.hoisted(() => ({
  editorPlugin: {
    api: {
      suggestion: {
        withoutSuggestions: (callback: () => void) => callback(),
      },
    },
    editor: {},
  } as any,
  pluginOptions: new Map<string, unknown>(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      translationMock[key as keyof typeof translationMock] ?? fallback ?? key,
  }),
}));

vi.mock('platejs/react', async importOriginal => {
  const actual = await importOriginal<typeof import('platejs/react')>();
  const React = await import('react');

  return {
    ...actual,
    PlateLeaf: ({
      as,
      attributes,
      children,
      className,
    }: {
      as?: keyof JSX.IntrinsicElements;
      attributes?: Record<string, unknown>;
      children: React.ReactNode;
      className?: string;
    }) => React.createElement(as ?? 'span', { ...attributes, className }, children),
    useEditorPlugin: () => plateReactMock.editorPlugin,
    usePluginOption: (_plugin: unknown, option: string, userId?: string) => {
      if (plateReactMock.pluginOptions.has(option)) return plateReactMock.pluginOptions.get(option);
      if (option === 'currentUserId') return 'manager-1';
      if (option === 'user') return { id: userId, name: 'Test User' };
      return null;
    },
  };
});

vi.mock('@platejs/suggestion', async importOriginal => {
  const actual = await importOriginal<typeof import('@platejs/suggestion')>();

  return {
    ...actual,
    acceptSuggestion: vi.fn(),
    rejectSuggestion: vi.fn(),
  };
});

vi.mock('@platejs/suggestion/react', () => ({
  SuggestionPlugin: {},
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, valuesOrFallback?: unknown, fallback?: string) =>
    fallback ?? (typeof valuesOrFallback === 'string' ? valuesOrFallback : _key),
}));

vi.mock('@/features/shared/ui/kit-platejs/suggestion-callbacks-context.tsx', () => ({
  useSuggestionCallbacks: () => suggestionCallbacksMock,
}));

vi.mock('@/features/shared/ui/kit-platejs/mode-context.tsx', () => ({
  useModeContext: () => modeContextMock,
}));

vi.mock('../comment.tsx', () => ({
  Comment: () => null,
  CommentCreateForm: () => null,
  formatCommentDate: () => 'today',
}));

import {
  BlockSuggestion,
  BlockSuggestionCard,
  type ResolvedSuggestion,
  useResolveSuggestion,
} from '../block-suggestion';
import { SuggestionLeaf } from '../suggestion-node';
import { BlockSuggestionStatic, SuggestionLineBreakStatic } from '../suggestion-node-static';

function internalVoteSuggestion(): ResolvedSuggestion {
  return {
    changeRequestEntityId: 'change-request-1',
    comments: [],
    createdAt: new Date(),
    keyId: 'suggestion_suggestion-1',
    suggestionId: 'suggestion-1',
    text: 'BR-1: Soll entfernt werden',
    type: 'remove',
    userId: 'author-1',
    votes: [],
    votesAbstain: 0,
    votesAgainst: 0,
    votesFor: 1,
    votingStatus: 'in_progress',
  } as ResolvedSuggestion;
}

function pendingEventSuggestion(): ResolvedSuggestion {
  return {
    changeRequestEntityId: 'change-request-pending-1',
    changeRequestStatus: 'pending_submission',
    comments: [],
    confirmationStatus: 'pending',
    createdAt: new Date(),
    keyId: 'suggestion_suggestion-pending-1',
    suggestionId: 'suggestion-pending-1',
    text: 'Wird',
    type: 'remove',
    userId: 'manager-1',
    votes: [],
    votesAbstain: 0,
    votesAgainst: 0,
    votesFor: 0,
  } as ResolvedSuggestion;
}

function submittedEventSuggestion(): ResolvedSuggestion {
  return {
    ...pendingEventSuggestion(),
    changeRequestStatus: 'open',
    confirmationStatus: 'confirmed',
    votingStatus: 'open',
  } as ResolvedSuggestion;
}

describe('BlockSuggestionCard internal vote actions', () => {
  beforeEach(() => {
    Object.values(suggestionCallbacksMock).forEach(mock => mock.mockReset());
    modeContextMock.currentMode = 'vote_internal';
    modeContextMock.isOwnerOrCollaborator = true;
    plateReactMock.pluginOptions.clear();
    plateReactMock.editorPlugin = {
      api: {
        suggestion: {
          withoutSuggestions: (callback: () => void) => callback(),
        },
      },
      editor: {},
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('labels the full-text internal vote close action clearly', () => {
    render(<BlockSuggestionCard idx={0} isLast suggestion={internalVoteSuggestion()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Interne Abstimmung beenden' }));

    expect(screen.queryByRole('button', { name: 'Abstimmung beenden' })).toBeNull();
    expect(screen.getByText('Interne Abstimmung beenden?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Interne Abstimmung beenden' })).toBeTruthy();
  });

  it('does not offer vote actions for a completed suggestion', () => {
    render(
      <BlockSuggestionCard
        idx={0}
        isLast
        suggestion={{
          ...internalVoteSuggestion(),
          changeRequestStatus: 'rejected',
          votingStatus: 'completed',
        }}
      />
    );

    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Abstain' })).toBeNull();
  });

  it('asks the author to submit pending event suggestions even with a persisted row', () => {
    modeContextMock.currentMode = 'suggest_event';

    render(<BlockSuggestionCard idx={0} isLast suggestion={pendingEventSuggestion()} />);

    expect(screen.getByText('Soll diese Änderung eingereicht werden?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Einreichen' }));

    expect(suggestionCallbacksMock.onEventSuggestionConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestEntityId: 'change-request-pending-1',
        confirmationStatus: 'pending',
      })
    );
  });

  it('lets the author discard pending event suggestions', () => {
    modeContextMock.currentMode = 'suggest_event';

    render(<BlockSuggestionCard idx={0} isLast suggestion={pendingEventSuggestion()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));

    expect(suggestionCallbacksMock.onEventSuggestionCancel).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestEntityId: 'change-request-pending-1',
        confirmationStatus: 'pending',
      })
    );
  });

  it('shows submitted vote pending status instead of the submit prompt for confirmed event suggestions', () => {
    modeContextMock.currentMode = 'suggest_event';

    render(<BlockSuggestionCard idx={0} isLast suggestion={submittedEventSuggestion()} />);

    expect(screen.getByText('Submitted - vote pending')).toBeTruthy();
    expect(screen.queryByText('Soll diese Änderung eingereicht werden?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Einreichen' })).toBeNull();
  });
});

describe('useResolveSuggestion block labels', () => {
  beforeEach(() => {
    plateReactMock.pluginOptions.clear();
  });

  afterEach(() => {
    cleanup();
  });

  function resolveBlockSuggestion(node: TElement) {
    const blockPath = [0];
    const suggestionNode = {
      ...node,
      suggestion: {
        createdAt: Date.now(),
        id: 'suggestion-1',
        type: 'insert',
        userId: 'author-1',
      },
    } as TElement;

    plateReactMock.pluginOptions.set('discussions', []);
    plateReactMock.pluginOptions.set('uniquePathMap', new Map([['suggestion-1', blockPath]]));
    plateReactMock.editorPlugin = {
      api: {
        node: vi.fn(() => undefined),
        suggestion: {
          dataList: vi.fn(() => []),
          isBlockSuggestion: vi.fn(currentNode => Boolean(currentNode?.suggestion)),
          node: vi.fn(() => [suggestionNode, blockPath]),
          nodeId: vi.fn(currentNode => currentNode?.suggestion?.id),
          suggestionData: vi.fn(currentNode => currentNode?.suggestion),
          withoutSuggestions: (callback: () => void) => callback(),
        },
      },
      editor: {
        api: {
          nodes: vi.fn(() => [[suggestionNode, blockPath]]),
        },
        getOption: vi.fn(() => null),
      },
      getOption: vi.fn(() => new Map([['suggestion-1', blockPath]])),
      setOption: vi.fn(),
    };

    return renderHook(() => useResolveSuggestion([[suggestionNode, blockPath]], blockPath));
  }

  it('resolves data view block suggestions without throwing', () => {
    const { result } = resolveBlockSuggestion({
      chartType: 'bar',
      children: [{ text: '' }],
      presentation: {},
      query: { aggregation: 'sum', filters: {} },
      source: {
        datasetId: 'dataset-id',
        kind: 'dataset',
        provider: 'UPLOAD',
        snapshotId: 'snapshot-id',
        title: 'Dataset',
      },
      type: 'data_view',
      view: 'chart',
    } as TElement);

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      newText: '__block__Chart',
      type: 'insert',
    });
  });

  it('falls back for unknown custom block suggestions', () => {
    const { result } = resolveBlockSuggestion({
      children: [{ text: '' }],
      type: 'custom_widget',
    } as TElement);

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      newText: '__block__Block',
      type: 'insert',
    });
  });
});

describe('suggestion editor styling', () => {
  beforeEach(() => {
    plateReactMock.pluginOptions.clear();
    plateReactMock.editorPlugin = {
      api: {
        suggestion: {
          dataList: vi.fn(() => []),
          nodeId: vi.fn(() => 'suggestion-1'),
          withoutSuggestions: (callback: () => void) => callback(),
        },
      },
      editor: {},
      setOption: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('uses green styling for inserted block suggestions', () => {
    render(
      <BlockSuggestion
        element={
          {
            children: [{ text: '' }],
            suggestion: { id: 'suggestion-1', type: 'insert' },
            type: 'data_view',
          } as any
        }
      />
    );

    const overlay = document.querySelector('[contenteditable="false"]');

    expect(overlay?.className).toContain('border-[var(--badge-success-border)]');
    expect(overlay?.className).toContain('bg-[var(--badge-success-bg)]');
    expect(overlay?.className).toContain('text-[var(--badge-success-fg)]');
  });

  it('uses red styling for removed block suggestions', () => {
    render(
      <BlockSuggestion
        element={
          {
            children: [{ text: '' }],
            suggestion: { id: 'suggestion-1', type: 'remove' },
            type: 'data_view',
          } as any
        }
      />
    );

    const overlay = document.querySelector('[contenteditable="false"]');

    expect(overlay?.className).toContain('border-[var(--badge-danger-border)]');
    expect(overlay?.className).toContain('bg-[var(--badge-danger-bg)]');
    expect(overlay?.className).toContain('text-[var(--badge-danger-fg)]');
  });

  it('uses green styling for inserted static preview block suggestions', () => {
    render(
      <BlockSuggestionStatic
        element={
          {
            children: [{ text: '' }],
            suggestion: { id: 'suggestion-1', type: 'insert' },
            type: 'data_view',
          } as any
        }
      />
    );

    const overlay = document.querySelector('[contenteditable="false"]');

    expect(overlay?.className).toContain('border-[var(--badge-success-border)]');
    expect(overlay?.className).toContain('bg-[var(--badge-success-bg)]');
    expect(overlay?.className).toContain('text-[var(--badge-success-fg)]');
  });

  it('uses red styling for removed static preview block suggestions', () => {
    render(
      <BlockSuggestionStatic
        element={
          {
            children: [{ text: '' }],
            suggestion: { id: 'suggestion-1', type: 'remove' },
            type: 'data_view',
          } as any
        }
      />
    );

    const overlay = document.querySelector('[contenteditable="false"]');

    expect(overlay?.className).toContain('border-[var(--badge-danger-border)]');
    expect(overlay?.className).toContain('bg-[var(--badge-danger-bg)]');
    expect(overlay?.className).toContain('text-[var(--badge-danger-fg)]');
  });

  it('uses green styling for inserted static preview line breaks', () => {
    render(
      <SuggestionLineBreakStatic
        suggestionData={{ id: 'suggestion-1', isLineBreak: true, type: 'insert' } as any}
      />
    );

    const indicator = document.querySelector('[contenteditable="false"]');

    expect(indicator?.className).toContain('border-[var(--badge-success-border)]');
    expect(indicator?.className).toContain('bg-[var(--badge-success-bg)]');
    expect(indicator?.className).toContain('text-[var(--badge-success-fg)]');
  });

  it('uses red styling for removed static preview line breaks', () => {
    render(
      <SuggestionLineBreakStatic
        suggestionData={{ id: 'suggestion-1', isLineBreak: true, type: 'remove' } as any}
      />
    );

    const indicator = document.querySelector('[contenteditable="false"]');

    expect(indicator?.className).toContain('border-[var(--badge-danger-border)]');
    expect(indicator?.className).toContain('bg-[var(--badge-danger-bg)]');
    expect(indicator?.className).toContain('text-[var(--badge-danger-fg)]');
    expect(indicator?.className).toContain('line-through');
  });

  it('uses green styling for inserted inline suggestions', () => {
    plateReactMock.editorPlugin.api.suggestion.dataList = vi.fn(() => [
      { id: 'suggestion-1', type: 'insert' },
    ]);

    render(
      <SuggestionLeaf attributes={{}} leaf={{ text: 'new text' } as any} text={{} as any}>
        new text
      </SuggestionLeaf>
    );

    const suggestion = screen.getByText('new text');

    expect(suggestion.getAttribute('data-suggestion-type')).toBe('insert');
    expect(suggestion.className).toContain('border-[var(--badge-success-border)]');
    expect(suggestion.className).toContain('bg-[var(--badge-success-bg)]');
    expect(suggestion.className).toContain('text-[var(--badge-success-fg)]');
  });

  it('uses red styling for removed inline suggestions', () => {
    plateReactMock.editorPlugin.api.suggestion.dataList = vi.fn(() => [
      { id: 'suggestion-1', type: 'remove' },
    ]);

    render(
      <SuggestionLeaf attributes={{}} leaf={{ text: 'old text' } as any} text={{} as any}>
        old text
      </SuggestionLeaf>
    );

    const suggestion = screen.getByText('old text');

    expect(suggestion.getAttribute('data-suggestion-type')).toBe('remove');
    expect(suggestion.className).toContain('border-[var(--badge-danger-border)]');
    expect(suggestion.className).toContain('bg-[var(--badge-danger-bg)]');
    expect(suggestion.className).toContain('text-[var(--badge-danger-fg)]');
    expect(suggestion.className).toContain('line-through');
  });
});
