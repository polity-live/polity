/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';
import { isSelectableByCollaborator } from '@/zero/amendments/editing-mode-policy';

const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  leave: vi.fn(),
  request: vi.fn(),
  state: {} as any,
  waitForClientApply: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'collaborator-1' } }),
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    requestCollaboration: mocks.request,
    leaveCollaboration: mocks.leave,
    acceptInvitation: mocks.accept,
  }),
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => mocks.state,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => mocks.waitForClientApply(...args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useAmendmentCollaboration } from '@/features/amendments/hooks/useAmendmentCollaboration';
import { VersionComparisonView } from '@/features/amendments/ui/VersionComparisonView';

function CollaborationEditor({ mode = 'edit' }: { mode?: 'edit' | 'view' }) {
  const collaboration = useAmendmentCollaboration('amendment-1');
  const [documentText, setDocumentText] = useState('Original document');
  const canEdit =
    collaboration.isCollaborator && mode === 'edit' && isSelectableByCollaborator(mode);

  return (
    <div>
      <output data-testid="collaboration-status">{collaboration.status ?? 'none'}</output>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setDocumentText('Collaboratively edited document')}
      >
        Edit document
      </button>
      <VersionComparisonView
        originalVersion="Original document"
        currentVersion={documentText}
        changeRequest={{ id: 'cr-1', title: 'Collaborator edit', description: 'Shared draft' }}
      />
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state = {
    collaboration: { id: 'collaboration-1' },
    status: 'active',
    isCollaborator: true,
    isAdmin: false,
    hasRequested: false,
    isInvited: false,
    collaboratorCount: 2,
    isLoading: false,
  };
  mocks.accept.mockResolvedValue(undefined);
  mocks.waitForClientApply.mockImplementation(async value => value);
});

afterEach(cleanup);

describe('amendment collaboration component flow', () => {
  it('accepts a collaborator invitation through the authenticated collaboration service', async () => {
    mocks.state = {
      ...mocks.state,
      status: 'invited',
      isCollaborator: false,
      isInvited: true,
    };
    const { result } = renderHook(() => useAmendmentCollaboration('amendment-1'));

    await act(async () => result.current.acceptInvitation());

    expect(mocks.accept).toHaveBeenCalledWith('collaboration-1');
    expect(mocks.waitForClientApply).toHaveBeenCalledOnce();
  });

  it('lets an active collaborator edit and compare the shared document', () => {
    renderComponentFlow(<CollaborationEditor />);

    expect(screen.getByTestId('collaboration-status').textContent).toBe('active');
    expect(screen.queryByText('Collaboratively edited document')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit document' }));

    expect(screen.getAllByText('Collaboratively edited document').length).toBeGreaterThan(0);
    expect(
      screen.getByText('features.amendments.supportConfirmation.comparison.hasChanges')
    ).toBeTruthy();
  });

  it('keeps document editing read-only when collaboration rights or edit mode are absent', () => {
    mocks.state = {
      ...mocks.state,
      status: 'requested',
      isCollaborator: false,
      hasRequested: true,
    };
    const { rerender } = renderComponentFlow(<CollaborationEditor />);
    expect(
      (screen.getByRole('button', { name: 'Edit document' }) as HTMLButtonElement).disabled
    ).toBe(true);

    mocks.state = { ...mocks.state, status: 'active', isCollaborator: true };
    rerender(<CollaborationEditor mode="view" />);
    expect(
      (screen.getByRole('button', { name: 'Edit document' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.queryByText('Collaboratively edited document')).toBeNull();
  });
});
