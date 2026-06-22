/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('platejs/react', async importOriginal => {
  const actual = await importOriginal<typeof import('platejs/react')>();

  return {
    ...actual,
    useEditorPlugin: () => ({
      api: {
        suggestion: {
          withoutSuggestions: (callback: () => void) => callback(),
        },
      },
      editor: {},
    }),
    usePluginOption: (_plugin: unknown, option: string, userId?: string) => {
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

import { BlockSuggestionCard, type ResolvedSuggestion } from '../block-suggestion';

function internalVoteSuggestion(): ResolvedSuggestion {
  return {
    changeRequestEntityId: 'change-request-1',
    comments: [],
    createdAt: Date.now(),
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
    createdAt: Date.now(),
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

describe('BlockSuggestionCard internal vote actions', () => {
  beforeEach(() => {
    Object.values(suggestionCallbacksMock).forEach(mock => mock.mockReset());
    modeContextMock.currentMode = 'vote_internal';
    modeContextMock.isOwnerOrCollaborator = true;
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
});
