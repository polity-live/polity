/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  mode: 'edit' as string,
  owner: true,
  selectedCrIds: null as Set<string> | null,
  discussions: [] as any[],
  users: {} as Record<string, { name?: string; avatarUrl?: string } | undefined>,
  currentUserId: 'viewer' as string | undefined,
  setOption: vi.fn(),
  withoutSuggestions: vi.fn((callback: () => void) => callback()),
  acceptSuggestion: vi.fn(),
  rejectSuggestion: vi.fn(),
  callbacks: {
    onSuggestionAccepted: vi.fn() as ((value: unknown) => void) | undefined,
    onSuggestionDeclined: vi.fn() as ((value: unknown) => void) | undefined,
    onFinalizeInternalVote: vi.fn() as ((value: unknown) => void) | undefined,
    onVoteAccept: vi.fn() as ((value: unknown) => void) | undefined,
    onVoteReject: vi.fn() as ((value: unknown) => void) | undefined,
    onVoteAbstain: vi.fn() as ((value: unknown) => void) | undefined,
    onEventSuggestionConfirm: vi.fn() as ((value: unknown) => unknown) | undefined,
    onEventSuggestionCancel: vi.fn() as ((value: unknown) => unknown) | undefined,
  },
  submitted: vi.fn(),
  lineBreakText: 'plateJs.blockSuggestion.lineBreaks',
}));

vi.mock('@platejs/suggestion', async importOriginal => {
  const actual = await importOriginal<typeof import('@platejs/suggestion')>();
  return {
    ...actual,
    acceptSuggestion: (...args: unknown[]) => state.acceptSuggestion(...args),
    rejectSuggestion: (...args: unknown[]) => state.rejectSuggestion(...args),
  };
});

vi.mock('@platejs/suggestion/react', () => ({ SuggestionPlugin: { key: 'suggestion' } }));

vi.mock('platejs/react', () => ({
  useEditorPlugin: () => ({
    api: { suggestion: { withoutSuggestions: state.withoutSuggestions } },
    editor: {
      getOption: () => state.discussions,
      setOption: (...args: unknown[]) => state.setOption(...args),
    },
  }),
  usePluginOption: (_plugin: unknown, key: string, id?: string) => {
    if (key === 'discussions') return state.discussions;
    if (key === 'currentUserId') return state.currentUserId;
    if (key === 'user') return id ? state.users[id] : undefined;
    return undefined;
  },
}));

vi.mock('@/features/shared/ui/kit-platejs/suggestion-callbacks-context.tsx', () => ({
  useSuggestionCallbacks: () => state.callbacks,
}));

vi.mock('@/features/shared/ui/kit-platejs/discussion-kit.tsx', () => ({
  discussionPlugin: { key: 'discussion' },
}));

vi.mock('@/features/shared/ui/kit-platejs/suggestion-kit.tsx', () => ({
  suggestionPlugin: { key: 'suggestion' },
}));

vi.mock('@/features/shared/ui/kit-platejs/mode-context.tsx', () => ({
  useModeContext: () => ({
    currentMode: state.mode,
    isOwnerOrCollaborator: state.owner,
    selectedCrIds: state.selectedCrIds,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, valuesOrFallback?: unknown, fallback?: string) =>
    fallback ?? (typeof valuesOrFallback === 'string' ? valuesOrFallback : key),
  useTranslation: () => ({
    t: (key: string) => (key === 'plateJs.blockSuggestion.lineBreaks' ? state.lineBreakText : key),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('lucide-react', () => ({
  CheckCircle2: () => <i data-icon="complete" />,
  CheckIcon: () => <i data-icon="check" />,
  Clock: () => <i data-icon="clock" />,
  XIcon: () => <i data-icon="x-icon" />,
  Pencil: () => <i data-icon="pencil" />,
  Check: () => <i data-icon="save-title" />,
  X: () => <i data-icon="cancel-title" />,
  MessageSquare: () => <i data-icon="comment" />,
}));

vi.mock('@/features/shared/ui/ui/avatar.tsx', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ alt, src }: { alt?: string; src?: string }) => (
    <span data-user-alt={alt ?? 'none'} data-user-src={src ?? 'none'} />
  ),
}));

vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    disabled?: boolean;
  }) => (
    <button type="button" data-disabled={disabled ?? false} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/input.tsx', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/features/shared/ui/ui/alert-dialog.tsx', () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/features/shared/theme', () => ({
  getBadgeToneClasses: (tone: string) => `badge-${tone}`,
  getMotionPreset: () => 'motion',
  getSemanticToneClasses: (tone: string) => ({ border: `border-${tone}` }),
}));

vi.mock('@/features/shared/utils/utils.ts', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));

vi.mock('../comment.tsx', () => ({
  Comment: ({ comment, index }: { comment: { id?: string }; index: number }) => (
    <div data-comment={`${comment.id ?? 'missing'}-${index}`} />
  ),
  CommentCreateForm: ({ onSubmitted }: { onSubmitted?: () => void }) => (
    <button
      type="button"
      data-submit-comment
      onClick={() => {
        state.submitted();
        onSubmitted?.();
      }}
    >
      submit comment
    </button>
  ),
}));

vi.mock('@/features/shared/ui/comments/DiscussionActions', () => ({
  DiscussionActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/comments/DiscussionTimestamp', () => ({
  DiscussionTimestamp: () => <time />,
}));

import {
  BlockSuggestion,
  BlockSuggestionCard,
  FilteredBlockSuggestion,
  type ResolvedSuggestion,
} from '../block-suggestion';

const suggestion = (overrides: Partial<ResolvedSuggestion> = {}): ResolvedSuggestion => ({
  comments: [],
  createdAt: new Date('2025-01-01T00:00:00Z'),
  keyId: 'suggestion_s1',
  suggestionId: 's1',
  text: 'Old text',
  type: 'remove',
  userId: 'author',
  votes: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.mode = 'edit';
  state.owner = true;
  state.selectedCrIds = null;
  state.discussions = [];
  state.users = { author: { name: 'Author', avatarUrl: 'avatar.png' } };
  state.currentUserId = 'viewer';
  state.lineBreakText = 'plateJs.blockSuggestion.lineBreaks';
  state.withoutSuggestions.mockImplementation(callback => callback());
  state.callbacks.onSuggestionAccepted = vi.fn();
  state.callbacks.onSuggestionDeclined = vi.fn();
  state.callbacks.onFinalizeInternalVote = vi.fn();
  state.callbacks.onVoteAccept = vi.fn();
  state.callbacks.onVoteReject = vi.fn();
  state.callbacks.onVoteAbstain = vi.fn();
  state.callbacks.onEventSuggestionConfirm = vi.fn();
  state.callbacks.onEventSuggestionCancel = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('block suggestion overlays and filtering', () => {
  it('omits line breaks and covers insert, remove, and missing suggestion data', () => {
    const lineBreak = render(
      <BlockSuggestion
        element={{ suggestion: { id: 's', isLineBreak: true, type: 'insert' } } as never}
      />
    );
    expect(lineBreak.container.firstChild).toBeNull();
    lineBreak.rerender(<BlockSuggestion element={{} as never} />);
    expect(lineBreak.container.querySelector('.border-success')).not.toBeNull();
    lineBreak.rerender(
      <BlockSuggestion element={{ suggestion: { id: 's', type: 'remove' } } as never} />
    );
    expect(lineBreak.container.querySelector('.border-danger')).not.toBeNull();
  });

  it('keeps unscoped and selected cards and filters only explicit mismatches', () => {
    state.discussions = [{ id: 's1', crId: 'CR-1' }];
    const view = render(
      <FilteredBlockSuggestion element={{ suggestion: { id: 's1', type: 'insert' } } as never} />
    );
    expect(view.container.firstChild).not.toBeNull();

    state.selectedCrIds = new Set(['CR-1']);
    view.rerender(
      <FilteredBlockSuggestion element={{ suggestion: { id: 's1', type: 'insert' } } as never} />
    );
    expect(view.container.firstChild).not.toBeNull();

    state.selectedCrIds = new Set(['CR-2']);
    view.rerender(
      <FilteredBlockSuggestion element={{ suggestion: { id: 's1', type: 'insert' } } as never} />
    );
    expect(view.container.firstChild).toBeNull();

    state.discussions = [];
    view.rerender(<FilteredBlockSuggestion element={{} as never} />);
    expect(view.container.firstChild).not.toBeNull();
  });
});

describe('BlockSuggestionCard content and editing', () => {
  it('renders remove, insert, replace, update, comments, ids, metadata, and last spacing variants', () => {
    const cases = [
      suggestion({
        displayCrId: 'DISPLAY',
        crId: 'CR-1',
        text: '__block__',
        title: 'Remove',
        type: 'remove',
      }),
      suggestion({ newText: 'One__block__Two', text: undefined, title: '', type: 'insert' }),
      suggestion({ newText: '__block__New', text: 'Old__block__More', type: 'replace' }),
      suggestion({
        newProperties: { color: 'blue' },
        newText: 'Updated',
        properties: { bold: true },
        type: 'update',
      }),
    ];
    const view = render(<BlockSuggestionCard idx={0} isLast={false} suggestion={cases[0]} />);
    expect(screen.getByText('DISPLAY')).toBeDefined();
    expect(screen.getByText('plateJs.blockSuggestion.lineBreaks')).toBeDefined();
    expect(view.container.querySelector('.h-2')).not.toBeNull();

    view.rerender(<BlockSuggestionCard idx={1} isLast suggestion={cases[1]} />);
    expect(document.body.textContent).toContain(
      'generated.inline.0142_untitled_suggestion_5d70b979'
    );
    view.rerender(<BlockSuggestionCard idx={2} isLast suggestion={cases[2]} />);
    expect(document.body.textContent).toContain('plateJs.blockSuggestion.replace');
    expect(document.body.textContent).toContain('plateJs.blockSuggestion.delete');
    view.rerender(<BlockSuggestionCard idx={3} isLast suggestion={cases[3]} />);
    expect(document.body.textContent).toContain('plateJs.blockSuggestion.unbold');
    expect(document.body.textContent).toContain('Color');

    view.rerender(
      <BlockSuggestionCard idx={4} isLast suggestion={suggestion({ crId: 'CR-only' })} />
    );
    expect(screen.getByText('CR-only')).toBeDefined();

    state.lineBreakText = '';
    view.rerender(
      <BlockSuggestionCard
        idx={5}
        isLast
        suggestion={suggestion({ newText: '__block__', text: undefined, type: 'insert' })}
      />
    );
    view.rerender(
      <BlockSuggestionCard
        idx={6}
        isLast
        suggestion={suggestion({ newText: '__block__', text: '__block__', type: 'replace' })}
      />
    );
  });

  it('saves titles into existing discussions by button and Enter while preserving other rows', () => {
    state.discussions = [
      { id: 's1', title: 'Old' },
      { id: 'other', title: 'Other' },
    ];
    const view = render(
      <BlockSuggestionCard idx={0} isLast suggestion={suggestion({ title: 'Initial' })} />
    );
    fireEvent.click(
      view.container.querySelector('[data-icon="pencil"]')?.closest('button') as HTMLElement
    );
    const input = view.container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(state.setOption).toHaveBeenCalledWith(expect.anything(), 'discussions', [
      expect.objectContaining({ id: 's1', title: 'Changed' }),
      expect.objectContaining({ id: 'other' }),
    ]);
  });

  it('creates missing discussions, cancels by button and Escape, and syncs changed titles', () => {
    const view = render(
      <BlockSuggestionCard idx={0} isLast suggestion={suggestion({ title: undefined })} />
    );
    fireEvent.click(
      view.container.querySelector('[data-icon="pencil"]')?.closest('button') as HTMLElement
    );
    let input = view.container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Created' } });
    fireEvent.click(
      view.container.querySelector('[data-icon="save-title"]')?.closest('button') as HTMLElement
    );
    expect(state.setOption).toHaveBeenCalledWith(expect.anything(), 'discussions', [
      expect.objectContaining({ id: 's1', title: 'Created', comments: [] }),
    ]);

    view.rerender(
      <BlockSuggestionCard idx={0} isLast suggestion={suggestion({ title: 'Synced' })} />
    );
    fireEvent.click(
      view.container.querySelector('[data-icon="pencil"]')?.closest('button') as HTMLElement
    );
    input = view.container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Discard' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.click(
      view.container.querySelector('[data-icon="pencil"]')?.closest('button') as HTMLElement
    );
    expect((view.container.querySelector('input') as HTMLInputElement).value).toBe('Synced');
    fireEvent.click(
      view.container.querySelector('[data-icon="cancel-title"]')?.closest('button') as HTMLElement
    );

    state.discussions = undefined as never;
    view.rerender(
      <BlockSuggestionCard idx={0} isLast suggestion={suggestion({ title: undefined })} />
    );
    fireEvent.click(
      view.container.querySelector('[data-icon="pencil"]')?.closest('button') as HTMLElement
    );
    fireEvent.keyDown(view.container.querySelector('input') as HTMLInputElement, { key: 'Escape' });
    fireEvent.click(
      view.container.querySelector('[data-icon="pencil"]')?.closest('button') as HTMLElement
    );
    fireEvent.click(
      view.container.querySelector('[data-icon="save-title"]')?.closest('button') as HTMLElement
    );
  });

  it('opens and submits the comment form and renders stable keys for present and absent ids', () => {
    const view = render(
      <BlockSuggestionCard
        idx={0}
        isLast
        suggestion={suggestion({
          comments: [{ id: 'comment', userId: 'author' } as never, { id: null } as never],
        })}
      />
    );
    fireEvent.click(
      view.container.querySelector('[data-icon="comment"]')?.closest('button') as HTMLElement
    );
    expect(view.container.querySelector('[data-submit-comment]')).not.toBeNull();
    fireEvent.click(view.container.querySelector('[data-submit-comment]') as HTMLElement);
    expect(state.submitted).toHaveBeenCalledOnce();
    expect(view.container.querySelector('[data-submit-comment]')).toBeNull();
  });
});

describe('BlockSuggestionCard action matrices', () => {
  it('accepts and rejects internal suggestions only while hovering in suggestion mode', () => {
    state.mode = 'suggest_internal';
    const view = render(<BlockSuggestionCard idx={0} isLast suggestion={suggestion()} />);
    const root = view.container.firstElementChild as HTMLElement;
    fireEvent.mouseEnter(root);
    const actionButtons = Array.from(view.container.querySelectorAll('button')).filter(button =>
      button.querySelector('[data-icon="check"], [data-icon="x-icon"]')
    );
    fireEvent.click(actionButtons[0]);
    fireEvent.click(actionButtons[1]);
    expect(state.acceptSuggestion).toHaveBeenCalled();
    expect(state.rejectSuggestion).toHaveBeenCalled();
    expect(state.callbacks.onSuggestionAccepted).toHaveBeenCalled();
    expect(state.callbacks.onSuggestionDeclined).toHaveBeenCalled();
    fireEvent.mouseLeave(root);
  });

  it('shows pending event descriptions for author/other and handles confirm/cancel success, absence, and rejection', async () => {
    state.mode = 'suggest_event';
    state.currentUserId = 'author';
    let resolveConfirm: (() => void) | undefined;
    state.callbacks.onEventSuggestionConfirm = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveConfirm = resolve;
        })
    );
    const pending = suggestion({ confirmationStatus: 'pending', changeRequestStatus: 'draft' });
    const view = render(<BlockSuggestionCard idx={0} isLast suggestion={pending} />);
    fireEvent.click(screen.getByRole('button', { name: 'Einreichen' }));
    expect(screen.getByText('Speichern...')).toBeDefined();
    resolveConfirm?.();
    await vi.waitFor(() => expect(screen.getByText('Einreichen')).toBeDefined());

    state.callbacks.onEventSuggestionCancel = vi.fn().mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    await vi.waitFor(() => expect(state.rejectSuggestion).toHaveBeenCalled());

    state.currentUserId = 'other';
    view.rerender(<BlockSuggestionCard idx={0} isLast suggestion={pending} />);
    expect(document.body.textContent).toContain('Der Vorschlag ist sichtbar');
    expect(screen.queryByRole('button', { name: 'Einreichen' })).toBeNull();

    state.currentUserId = 'author';
    state.callbacks.onEventSuggestionConfirm = undefined;
    state.callbacks.onEventSuggestionCancel = undefined;
    view.rerender(<BlockSuggestionCard idx={0} isLast suggestion={pending} />);
    fireEvent.click(screen.getByRole('button', { name: 'Einreichen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    await vi.waitFor(() => expect(state.rejectSuggestion).toHaveBeenCalledTimes(2));

    state.callbacks.onEventSuggestionCancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
    view.rerender(<BlockSuggestionCard idx={0} isLast suggestion={pending} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    await vi.waitFor(() => expect(state.callbacks.onEventSuggestionCancel).toHaveBeenCalled());
  });

  it('covers confirmed/open event combinations', () => {
    state.mode = 'suggest_event';
    const view = render(
      <BlockSuggestionCard
        idx={0}
        isLast
        suggestion={suggestion({ confirmationStatus: 'confirmed' })}
      />
    );
    expect(screen.getByText('Submitted - vote pending')).toBeDefined();
    view.rerender(
      <BlockSuggestionCard
        idx={0}
        isLast
        suggestion={suggestion({ confirmationStatus: 'pending', changeRequestStatus: 'open' })}
      />
    );
    expect(screen.getByText('Submitted - vote pending')).toBeDefined();
  });

  it('renders all current-vote tones, counts, deadline states, and vote callbacks', () => {
    state.mode = 'vote_internal';
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const base = suggestion({
      changeRequestEntityId: 'cr',
      closeTrigger: 'after_minutes',
      votingDeadline: 121_000,
      votes: [{ id: 'v', voterId: 'viewer', vote: 'accept' }],
      votesFor: 2,
      votesAgainst: 1,
      votesAbstain: 1,
      votingStatus: 'open',
    });
    const view = render(<BlockSuggestionCard idx={0} isLast suggestion={base} />);
    expect(document.body.textContent).toContain('Closes in 2 min');
    expect(view.container.querySelector('.badge-success')).not.toBeNull();
    for (const label of [
      'generated.inline.0121_accept_bb54db51',
      'generated.inline.1142_reject_2b03b592',
      'generated.inline.1144_abstain_bc39d849',
    ]) {
      fireEvent.click(screen.getAllByRole('button', { name: label }).at(-1) as HTMLElement);
    }
    expect(state.callbacks.onVoteAccept).toHaveBeenCalled();
    expect(state.callbacks.onVoteReject).toHaveBeenCalled();
    expect(state.callbacks.onVoteAbstain).toHaveBeenCalled();

    view.rerender(
      <BlockSuggestionCard
        idx={0}
        isLast
        suggestion={{ ...base, votes: [{ id: 'v', voterId: 'viewer', vote: 'reject' }] }}
      />
    );
    expect(view.container.querySelector('.badge-danger')).not.toBeNull();
    view.rerender(
      <BlockSuggestionCard
        idx={0}
        isLast
        suggestion={{ ...base, votes: [{ id: 'v', voterId: 'viewer', vote: 'abstain' }] }}
      />
    );
    expect(document.body.textContent).toContain('Abstain');
    view.rerender(
      <BlockSuggestionCard idx={0} isLast suggestion={{ ...base, votingDeadline: 1 }} />
    );
    expect(document.body.textContent).toContain('Deadline expired');
  });

  it('derives fallback vote counts, no-vote prompt, collaborator totals, projected outcomes, and completed states', () => {
    state.mode = 'event_final_closing_vote';
    const votes = [
      { id: 'a', voterId: 'a', vote: 'accept' },
      { id: 'r', voterId: 'r', vote: 'reject' },
      { id: 'x', voterId: 'x', vote: 'abstain' },
    ];
    const view = render(<BlockSuggestionCard idx={0} isLast suggestion={suggestion({ votes })} />);
    expect(document.body.textContent).toContain('plateJs.blockSuggestion.voteRequired');

    view.rerender(
      <BlockSuggestionCard idx={0} isLast suggestion={suggestion({ votes: undefined })} />
    );

    state.mode = 'vote_internal';
    view.rerender(
      <BlockSuggestionCard
        idx={0}
        isLast
        suggestion={suggestion({ eligibleVoterCount: 5, votedCollaboratorCount: 2, votes })}
      />
    );
    expect(document.body.textContent).toContain('2/5');

    for (const status of ['accepted', 'approved', 'rejected', 'declined']) {
      view.rerender(
        <BlockSuggestionCard
          idx={0}
          isLast
          suggestion={suggestion({ changeRequestStatus: status, votes })}
        />
      );
    }
    view.rerender(
      <BlockSuggestionCard
        idx={0}
        isLast
        suggestion={suggestion({ votingStatus: 'completed', votes })}
      />
    );
  });

  it('covers interval setup/cleanup and every finalization guard', () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(window, 'clearInterval');
    state.mode = 'vote_internal';
    const base = suggestion({
      changeRequestEntityId: 'cr',
      votingDeadline: Date.now() + 60_000,
      votingStatus: 'open',
    });
    const view = render(<BlockSuggestionCard idx={0} isLast suggestion={base} />);
    vi.advanceTimersByTime(30_000);
    const finalButtons = screen.getAllByRole('button', {
      name: 'plateJs.blockSuggestion.finalizeInternalVote',
    });
    fireEvent.click(finalButtons.at(-1) as HTMLElement);
    expect(state.callbacks.onFinalizeInternalVote).toHaveBeenCalled();

    state.owner = false;
    view.rerender(<BlockSuggestionCard idx={0} isLast suggestion={base} />);
    state.owner = true;
    view.rerender(
      <BlockSuggestionCard
        idx={0}
        isLast
        suggestion={{ ...base, changeRequestEntityId: undefined }}
      />
    );
    view.rerender(
      <BlockSuggestionCard idx={0} isLast suggestion={{ ...base, votingStatus: 'completed' }} />
    );
    state.callbacks.onFinalizeInternalVote = undefined;
    view.rerender(<BlockSuggestionCard idx={0} isLast suggestion={base} />);
    state.mode = 'edit';
    view.rerender(
      <BlockSuggestionCard idx={0} isLast suggestion={{ ...base, votingDeadline: undefined }} />
    );
    view.unmount();
    expect(clear).toHaveBeenCalled();
  });
});
