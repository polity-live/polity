/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorViewShell } from '../EditorViewShell';

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">Share</button>,
}));

vi.mock('@/features/shared/ui/kit-platejs/plate-editor', () => ({
  PlateEditor: ({ readOnly }: { readOnly: boolean }) => (
    <div data-testid="plate-editor" data-read-only={String(readOnly)} />
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
  it('renders public amendment text read-only without the top toolbar', () => {
    render(<EditorViewShell model={model(false)} />);

    expect(screen.getByTestId('plate-editor').dataset.readOnly).toBe('true');
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('keeps the toolbar available when the caller permits it', () => {
    render(<EditorViewShell model={model(true)} />);

    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });
});
