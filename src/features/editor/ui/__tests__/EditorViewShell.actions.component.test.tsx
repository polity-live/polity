/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorViewShell } from '../EditorViewShell';

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ 'data-action-id': actionId }: any) => (
    <button type="button" data-action-id={actionId}>
      Share
    </button>
  ),
}));

vi.mock('@/features/shared/ui/kit-platejs/plate-editor', () => ({
  PlateEditor: ({ editorClassName, readOnly }: { editorClassName?: string; readOnly: boolean }) => (
    <div
      data-testid="plate-editor"
      data-editor-class-name={editorClassName}
      data-read-only={String(readOnly)}
    />
  ),
}));

vi.mock('../EditorHeader', () => ({
  EditorHeader: () => <div data-testid="editor-header" />,
}));

vi.mock('../OnlineCollaboratorAvatars', () => ({
  OnlineCollaboratorAvatars: () => null,
}));

vi.mock('@/features/editor/logic/changeRequestMotion', () => ({
  applyChangeRequestMotionDelays: () => ({
    didChange: false,
    signature: '',
    totalDurationMs: 0,
  }),
  shouldUpdateChangeRequestMotionForMutations: () => false,
}));

afterEach(() => cleanup());

function model(showTopToolbar: boolean) {
  return {
    activeCursorUserIds: new Set(),
    amendmentId: 'amendment-1',
    amendmentTitle: 'Amendment',
    canManageChangeRequestVotes: false,
    canVoteOnChangeRequests: false,
    capabilities: {
      editing: false,
      suggestions: false,
      comments: false,
      versioning: false,
      invites: false,
      presence: false,
      sharing: true,
    },
    compactToolbarSpacing: true,
    content: [],
    contentEntityId: 'document-1',
    currentUser: undefined,
    discussions: [],
    editorUsers: {},
    entity: {
      id: 'document-1',
      title: 'Public amendment',
      content: [],
      visibility: 'public',
      collaborators: [],
      extraUsers: [],
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
    onlinePeerMap: new Map(),
    presenceColorByUserId: new Map(),
    readOnly: true,
    saveStatus: 'saved',
    selectedCrIds: null,
    showTopToolbar,
    statusBadgeLabel: null,
    title: 'Public amendment',
    userColor: '#000000',
    userId: undefined,
    onSuggestionAccepted: vi.fn(),
    onSuggestionDeclined: vi.fn(),
    onFinalizeInternalVote: vi.fn(),
    onVoteAbstain: vi.fn(),
    onVoteAccept: vi.fn(),
    onVoteReject: vi.fn(),
    restoreVersion: vi.fn(),
    setActiveCursorUserIds: vi.fn(),
    setContent: vi.fn(),
    setDiscussions: vi.fn(),
    setIsEditingTitle: vi.fn(),
    setMode: vi.fn(),
    setSelectedCrIds: vi.fn(),
    setTitle: vi.fn(),
  } as any;
}

describe('EditorViewShell action toolbar', () => {
  it('relies on the shared entity frame instead of adding another horizontal inset', () => {
    const { container } = render(<EditorViewShell model={model(false)} />);
    const shell = container.firstElementChild;

    expect(shell?.className).toContain('w-full');
    expect(shell?.className).not.toContain('md:px-8');
    expect(shell?.className).toContain('pt-7');
  });

  it('renders public amendment text read-only without the top toolbar', () => {
    const { container } = render(<EditorViewShell model={model(false)} />);

    const editor = screen.getByTestId('plate-editor');
    const cardHeader = container.querySelector('[data-slot="card-header"]');
    const cardContent = container.querySelector('[data-slot="card-content"]');

    expect(editor.dataset.readOnly).toBe('true');
    expect(editor.dataset.editorClassName).toContain('px-0');
    expect(editor.dataset.editorClassName).toContain('md:px-[max(64px,calc(50%-350px))]');
    expect(cardHeader?.className).toContain('p-6');
    expect(cardContent?.className).toContain('p-6');
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('keeps the toolbar available when the caller permits it', () => {
    render(<EditorViewShell model={model(true)} />);

    expect(screen.getByRole('button', { name: 'Share' }).dataset.actionId).toBe(
      'editor.shell.share.open'
    );
  });
});
