/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  plateProps: undefined as Record<string, any> | undefined,
  headerProps: undefined as Record<string, any> | undefined,
  avatarProps: undefined as Record<string, any> | undefined,
  applyMotion: vi.fn(),
  shouldUpdateMotion: vi.fn(),
  observerCallback: undefined as ((mutations: MutationRecord[]) => void) | undefined,
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, unknown>) => (
    <button data-testid="share" data-url={props.url as string}>
      {props.description as string}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: ({ label }: { label: string }) => <div data-testid="page-skeleton">{label}</div>,
}));
vi.mock('@/features/shared/ui/kit-platejs/plate-editor', () => ({
  PlateEditor: (props: Record<string, unknown>) => {
    mocks.plateProps = props;
    return <div data-testid="plate-editor" />;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/editor/logic/changeRequestMotion', () => ({
  applyChangeRequestMotionDelays: (...args: unknown[]) => mocks.applyMotion(...args),
  shouldUpdateChangeRequestMotionForMutations: (...args: unknown[]) =>
    mocks.shouldUpdateMotion(...args),
}));
vi.mock('../EditorHeader', () => ({
  EditorHeader: (props: Record<string, unknown>) => {
    mocks.headerProps = props;
    return <div data-testid="editor-header">{props.presenceSlot as React.ReactNode}</div>;
  },
}));
vi.mock('../InviteCollaboratorDialog', () => ({
  InviteCollaboratorDialog: () => <div data-testid="invite" />,
}));
vi.mock('../OnlineCollaboratorAvatars', () => ({
  OnlineCollaboratorAvatars: (props: Record<string, unknown>) => {
    mocks.avatarProps = props;
    return <div data-testid="avatars" />;
  },
}));
vi.mock('../SuggestionViewToggle', () => ({
  SuggestionViewToggle: () => <div data-testid="suggestion-toggle" />,
}));
vi.mock('../VersionControl', () => ({
  VersionControl: () => <div data-testid="version-control" />,
}));

import { EditorViewShell } from '../EditorViewShell';

function baseModel(overrides: Record<string, unknown> = {}) {
  return {
    activeCursorUserIds: new Set(['peer']),
    amendmentId: 'amendment-1',
    amendmentTitle: 'Amendment',
    canManageChangeRequestVotes: false,
    canVoteOnChangeRequests: false,
    capabilities: {
      editing: true,
      suggestions: true,
      comments: true,
      versioning: false,
      invites: false,
      presence: false,
      sharing: false,
    },
    compactToolbarSpacing: false,
    content: [{ type: 'p', children: [{ text: 'Text' }] }],
    contentEntityId: 'document-1',
    currentUser: undefined,
    discussions: [],
    editorUsers: {},
    entity: {
      id: 'document-1',
      collaborators: [],
      metadata: {},
    },
    entityId: 'amendment-1',
    entityType: 'amendment',
    existingCollaboratorIds: [],
    hasAccess: true,
    hasUnsavedChanges: false,
    isEditingTitle: false,
    isLoading: false,
    isOwnerOrCollaborator: false,
    isSavingTitle: false,
    mode: 'edit',
    modeDisabledReasons: {},
    onSuggestionAccepted: vi.fn(),
    onSuggestionDeclined: vi.fn(),
    onFinalizeInternalVote: vi.fn(),
    onVoteAbstain: vi.fn(),
    onVoteAccept: vi.fn(),
    onVoteReject: vi.fn(),
    onlinePeerMap: new Map(),
    presenceColorByUserId: new Map(),
    readOnly: false,
    restoreVersion: vi.fn(),
    saveStatus: 'saved',
    showTopToolbar: false,
    selectedCrIds: null,
    setActiveCursorUserIds: vi.fn(),
    setContent: vi.fn(),
    setDiscussions: vi.fn(),
    setIsEditingTitle: vi.fn(),
    setMode: vi.fn(),
    setSelectedCrIds: vi.fn(),
    setTitle: vi.fn(),
    statusBadgeLabel: null,
    title: 'Title',
    userColor: '#123456',
    userId: undefined,
    ...overrides,
  } as any;
}

class FakeMutationObserver {
  constructor(callback: (mutations: MutationRecord[]) => void) {
    mocks.observerCallback = callback;
  }
  observe = mocks.observe;
  disconnect = mocks.disconnect;
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.plateProps = undefined;
  mocks.headerProps = undefined;
  mocks.avatarProps = undefined;
  mocks.observerCallback = undefined;
  mocks.applyMotion.mockReset();
  mocks.applyMotion.mockReturnValue({
    didChange: false,
    signature: 'initial',
    totalDurationMs: 10,
  });
  mocks.shouldUpdateMotion.mockReset();
  mocks.shouldUpdateMotion.mockReturnValue(false);
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('EditorViewShell branch contract', () => {
  it('renders disabled-motion loading, not-found, and denied states', () => {
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
    const view = render(
      <EditorViewShell model={baseModel({ entityType: 'group', isLoading: true })} />
    );
    expect(screen.getByTestId('page-skeleton').textContent).toContain('pageSkeleton');

    view.rerender(<EditorViewShell model={baseModel({ entity: null })} />);
    expect(document.body.textContent).toContain('features.editor.errors.notFound');

    view.rerender(<EditorViewShell model={baseModel({ hasAccess: false })} />);
    expect(document.body.textContent).toContain('features.editor.errors.noAccess');
  });

  it('renders a complete editable amendment toolbar and forwards privileged callbacks', () => {
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
    const model = baseModel({
      canManageChangeRequestVotes: true,
      canVoteOnChangeRequests: true,
      capabilities: {
        editing: true,
        suggestions: true,
        comments: true,
        versioning: true,
        invites: true,
        presence: true,
        sharing: true,
      },
      compactToolbarSpacing: true,
      currentUser: { id: 'user-1', name: 'Alice', avatarUrl: 'alice.png' },
      discussions: [{ id: 'discussion-1' }],
      entity: {
        id: 'document-1',
        collaborators: [{ id: 'collab-1' }],
        metadata: {
          amendmentCode: 'A-1',
          blogUpvotes: 0,
          groupId: 'group-1',
          groupName: 'Council',
          canViewDatasets: true,
          canManageDatasets: true,
        },
      },
      isOwnerOrCollaborator: true,
      mode: 'suggest_internal',
      showTopToolbar: true,
      statusBadgeLabel: 'draft',
      userId: 'user-1',
    });
    const { container } = render(<EditorViewShell model={model} />);

    expect(screen.getByTestId('share').dataset.url).toBe('/amendment/amendment-1');
    expect(screen.getByTestId('version-control')).toBeTruthy();
    expect(screen.getByTestId('suggestion-toggle')).toBeTruthy();
    expect(screen.getByTestId('invite')).toBeTruthy();
    expect(container.firstElementChild?.className).toContain('pt-7');
    expect(container.querySelector('[data-tutorial-anchor="amendment-text-editor"]')).toBeTruthy();
    expect(document.body.textContent).toContain('A-1');
    expect(document.body.textContent).toContain('0');
    expect(mocks.plateProps).toMatchObject({
      readOnly: false,
      isOwnerOrCollaborator: true,
      onSuggestionAccepted: model.onSuggestionAccepted,
      onSuggestionDeclined: model.onSuggestionDeclined,
      onVoteAccept: model.onVoteAccept,
      onVoteReject: model.onVoteReject,
      onVoteAbstain: model.onVoteAbstain,
      onFinalizeInternalVote: model.onFinalizeInternalVote,
      currentUser: { id: 'user-1', name: 'Alice', avatar: 'alice.png' },
      datasetContext: {
        defaultGroupId: 'group-1',
        defaultGroupName: 'Council',
        canViewDatasets: true,
        canManageDatasets: true,
        canUploadDatasets: true,
      },
    });
    expect(mocks.plateProps?.onDiscussionsChange).toBe(model.setDiscussions);
    expect(mocks.plateProps?.remoteCursors.userName).toBe('Alice');
    expect(mocks.avatarProps?.enabled).toBe(true);
  });

  it.each(['suggest_event', 'event_final_closing_vote'])(
    'makes amendment %s mode read-only and suppresses discussion writes',
    mode => {
      vi.stubGlobal('MutationObserver', undefined);
      render(
        <EditorViewShell
          model={baseModel({
            mode,
            readOnly: false,
            isOwnerOrCollaborator: true,
            discussions: [{ id: 'discussion' }],
            showTopToolbar: true,
            capabilities: {
              versioning: true,
              invites: true,
              presence: false,
              sharing: true,
            },
            userId: 'user-1',
          })}
        />
      );

      expect(mocks.plateProps?.readOnly).toBe(true);
      expect(mocks.plateProps?.isOwnerOrCollaborator).toBe(false);
      expect(mocks.plateProps?.onDiscussionsChange).toBeUndefined();
      expect(screen.queryByTestId('version-control')).toBeNull();
    }
  );

  it('forwards conservative fallbacks for a non-amendment without toolbar privileges', () => {
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
    const { container } = render(
      <EditorViewShell
        model={baseModel({
          entityType: 'group',
          entityId: 'group-1',
          contentEntityId: '',
          currentUser: undefined,
          mode: 'vote_internal',
          readOnly: true,
          showTopToolbar: true,
          statusBadgeLabel: '',
          capabilities: {
            versioning: true,
            invites: true,
            presence: false,
            sharing: false,
          },
          userId: undefined,
        })}
      />
    );

    expect(container.firstElementChild?.className).toContain('pt-8');
    expect(container.querySelector('[data-tutorial-anchor]')).toBeNull();
    expect(screen.queryByTestId('share')).toBeNull();
    expect(screen.queryByTestId('version-control')).toBeNull();
    expect(screen.queryByTestId('invite')).toBeNull();
    expect(screen.queryByTestId('suggestion-toggle')).toBeNull();
    expect(mocks.plateProps).toMatchObject({
      currentUser: undefined,
      onSuggestionAccepted: undefined,
      onSuggestionDeclined: undefined,
      onVoteAccept: undefined,
      onVoteReject: undefined,
      onVoteAbstain: undefined,
      onFinalizeInternalVote: undefined,
      datasetContext: {
        defaultGroupId: null,
        defaultGroupName: null,
        canViewDatasets: false,
        canManageDatasets: false,
        canUploadDatasets: false,
      },
    });
    expect(mocks.plateProps?.remoteCursors.userName).toBe('Anonymous');
  });

  it('reacts only to relevant mutations, reschedules changed motion, and completes it', () => {
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
    mocks.shouldUpdateMotion
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValue(true);
    mocks.applyMotion
      .mockReturnValueOnce({ didChange: false, signature: 'initial', totalDurationMs: 10 })
      .mockReturnValueOnce({ didChange: false, signature: 'same', totalDurationMs: 20 })
      .mockReturnValueOnce({ didChange: true, signature: 'changed', totalDurationMs: 30 });

    const view = render(<EditorViewShell model={baseModel({ entityType: 'blog' })} />);
    const scope = view.container.querySelector<HTMLElement>('.change-request-load-motion');
    expect(scope?.dataset.changeRequestMotionReady).toBe('true');
    expect(mocks.observe).toHaveBeenCalled();

    mocks.observerCallback?.([]);
    mocks.observerCallback?.([]);
    mocks.observerCallback?.([]);
    expect(mocks.applyMotion).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(30);
    expect(scope?.dataset.changeRequestMotionComplete).toBe('true');
    expect(mocks.disconnect).toHaveBeenCalled();
    view.unmount();
  });

  it('cleans up safely when the timer host returns a falsy handle', () => {
    vi.stubGlobal('MutationObserver', undefined);
    vi.spyOn(globalThis, 'setTimeout').mockReturnValue(0 as unknown as NodeJS.Timeout);

    const view = render(<EditorViewShell model={baseModel()} />);
    view.unmount();
  });
});
