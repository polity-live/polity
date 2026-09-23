/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useStudioProcedure, proposalNodeIds } from '../useStudioProcedure';
import type { CanvasSession } from '../../logic/governance';
import { StudioPlateDiff } from '../StudioPlateDiff';
import { Toolbar } from '@/features/shared/ui/layout';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'voter' } }) }));
afterEach(cleanup);

const proposal = {
  id: 'proposal',
  title: 'New introduction',
  reason: 'Clearer language',
  owner_id: 'author',
  shared_ids: [],
  revision: 1,
  base_revision: 0,
  state: 'voting' as const,
  decision: null,
  application: 'pending' as const,
  resolves_id: null,
  deadline: null,
  electorate: ['voter'],
  votes: [],
  changes: [
    { path: ['nodes', '#node-1', 'content'], before: { value: 'Old' }, after: { value: 'New' } },
  ],
};

function Harness({
  request,
  chooseWorkspace = vi.fn(),
}: {
  request: ReturnType<typeof vi.fn>;
  chooseWorkspace?: (id?: string) => void;
}) {
  const procedure = useStudioProcedure({
    projectId: 'project',
    chooseWorkspace,
    c: {
      actions: { request },
      commit: vi.fn().mockResolvedValue(0),
      selected: [],
      v3Value: { nodes: [] },
    } as never,
  });
  return (
    <div>
      <Toolbar>{procedure.modeButton}</Toolbar>
      <div>{procedure.canvasOverlay}</div>
      <button onClick={() => procedure.selectProposal('proposal')}>Open marker</button>
      <span data-testid="marker-count">{procedure.markers.length}</span>
    </div>
  );
}

it('groups a proposal with several changed fields under one canvas node marker', () => {
  expect(
    proposalNodeIds({
      ...proposal,
      changes: [
        { path: ['nodes', '#node-1', 'name'], before: {}, after: {} },
        { path: ['nodes', '#node-1', 'content'], before: {}, after: {} },
        { path: ['nodes', '#node-2'], before: {}, after: {} },
      ],
    })
  ).toEqual(['node-1', 'node-2']);
});

it('puts the labeled mode button in the toolbar with only the three Studio modes', async () => {
  const session = {
    phase: 'edit',
    groupId: 'group',
    generation: 'generation',
    capabilities: {
      read: true,
      edit: true,
      suggest: true,
      comment: true,
      vote: true,
      manage: true,
    },
    proposals: [],
    comments: [],
    revisions: [],
    members: [],
    roles: [],
    adoptionGroups: [],
  } as CanvasSession;
  const request = vi.fn(async (_type: string, input: { action?: string }) =>
    input.action === 'session' ? session : { ok: true }
  );
  render(<Harness request={request} />);
  const trigger = await screen.findByRole('button', { name: 'Collaborative Editing' });
  expect(trigger.closest('[role="toolbar"]')).not.toBeNull();
  fireEvent.pointerDown(trigger);
  await waitFor(() => expect(screen.getAllByRole('menuitemradio')).toHaveLength(3));
  expect(screen.queryByText('Viewing')).toBeNull();
  expect(screen.queryByText('Event Suggestions')).toBeNull();
});

it('opens a canvas request, records a comment and casts a vote using the shared controls', async () => {
  const session = {
    phase: 'vote_internal',
    groupId: 'group',
    generation: 'generation',
    capabilities: {
      read: true,
      edit: false,
      suggest: true,
      comment: true,
      vote: true,
      manage: false,
    },
    proposals: [proposal],
    comments: [],
    revisions: [],
    members: [],
    roles: [],
    adoptionGroups: [],
  } as CanvasSession;
  const request = vi.fn(async (_type: string, input: { action?: string }) =>
    input.action === 'session'
      ? session
      : input.action === 'loadDraft'
        ? { document: { nodes: [] } }
        : { ok: true }
  );
  render(<Harness request={request} />);
  await waitFor(() => expect(screen.getByText('New introduction')).toBeTruthy());
  expect(screen.getByTestId('marker-count').textContent).toBe('1');
  fireEvent.click(screen.getByRole('button', { name: 'Open marker' }));
  await waitFor(() => expect(screen.getByRole('region', { name: 'Änderungsantrag' })).toBeTruthy());
  fireEvent.change(screen.getByRole('textbox', { name: 'Kommentar' }), {
    target: { value: 'Looks good' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Kommentieren' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      'canvas',
      expect.objectContaining({ action: 'comment', body: 'Looks good' })
    )
  );
  fireEvent.click(screen.getByRole('button', { name: 'Ja' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      'canvas',
      expect.objectContaining({ action: 'vote', choice: 'accept', workspaceId: 'proposal' })
    )
  );
});

it('keeps a new suggestion private until its canvas draft is explicitly submitted', async () => {
  const session = {
    phase: 'suggest_internal',
    groupId: 'group',
    generation: 'generation',
    capabilities: {
      read: true,
      edit: false,
      suggest: true,
      comment: true,
      vote: true,
      manage: false,
    },
    proposals: [],
    comments: [],
    revisions: [],
    members: [],
    roles: [],
    adoptionGroups: [],
  } as CanvasSession;
  const request = vi.fn(async (_type: string, input: { action?: string }) =>
    input.action === 'session' ? session : { workspaceId: 'private-draft' }
  );
  const chooseWorkspace = vi.fn();
  render(<Harness request={request} chooseWorkspace={chooseWorkspace} />);
  fireEvent.change(await screen.findByRole('textbox', { name: 'Antragstitel' }), {
    target: { value: 'Improve layout' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Vorschlag beginnen' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      'canvas',
      expect.objectContaining({
        action: 'createDraft',
        title: 'Improve layout',
      })
    )
  );
  expect(chooseWorkspace).toHaveBeenCalledWith('private-draft');
});

it('shows inserted and removed text in a read-only Plate preview', () => {
  render(<StudioPlateDiff before="Old wording" after="New wording" />);
  expect(screen.getByText('Old').closest('.line-through')).not.toBeNull();
  expect(screen.getByText('New').closest('.line-through')).toBeNull();
});
