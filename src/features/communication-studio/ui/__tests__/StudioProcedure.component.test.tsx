/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useStudioProcedure, proposalNodeIds } from '../useStudioProcedure';
import type { CanvasSession } from '../../logic/governance';
import { StudioPlateDiff } from '../StudioPlateDiff';
import { Toolbar } from '@/features/shared/ui/layout';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { diffStudio } from '../../logic/operations';
import type { StudioDocumentV3 } from '../../logic/document-v3';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'voter' } }) }));
afterEach(cleanup);

function procedureSession(overrides: Partial<CanvasSession> = {}): CanvasSession {
  return {
    canEditProject: true,
    groupId: null,
    phase: 'edit',
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
    ...overrides,
  };
}

it.each(['group', null])(
  'uses the same mode and change-request controls for project group %s',
  async groupId => {
    const session = procedureSession({ groupId });
    const request = vi.fn(async (type, input) =>
      type === 'load' ? { revision: 0 } : input.action === 'session' ? session : { ok: true }
    );
    render(<Harness request={request} />);
    const trigger = await screen.findByRole('button', { name: 'Collaborative Editing' });
    expect(screen.getByText('Änderungsanträge (0)')).toBeTruthy();
    fireEvent.pointerDown(trigger);
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Internal Suggestions/ }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        'canvas',
        expect.objectContaining({ action: 'phase', phase: 'suggest_internal' })
      )
    );
  }
);

it.each([
  ['suggest_internal', 'suggestionPhaseReadOnly'],
  ['vote_internal', 'votingPhaseReadOnly'],
  ['edit', ''],
] as const)('explains the %s phase independently of admin rights', async (phase, reason) => {
  const session = procedureSession({ groupId: 'group', phase });
  const request = vi.fn(async () => session);
  render(<Harness request={request} canEdit={phase === 'edit'} />);
  await waitFor(() => expect(screen.getByTestId('read-only-reason').textContent).toBe(reason));
  expect(screen.getByTestId('editor-allowed').textContent).toBe(String(phase === 'edit'));
});

it('distinguishes missing project rights and locked proposal drafts from phase locks', async () => {
  const session = procedureSession({ canEditProject: false, phase: 'suggest_internal' });
  const request = vi.fn(async (_type, input) =>
    input.action === 'session' ? session : { baseDocument: { nodes: [] } }
  );
  const view = render(<Harness request={request} canEdit={false} />);
  await waitFor(() => expect(screen.getByTestId('read-only-reason').textContent).toBe('readOnly'));
  view.rerender(<Harness request={request} workspaceId="draft" canEdit={false} />);
  await waitFor(() =>
    expect(screen.getByTestId('read-only-reason').textContent).toBe('proposalDraftReadOnly')
  );
});

it('keeps an authorized proposal draft editable during the suggestion phase', async () => {
  const session = procedureSession({
    phase: 'suggest_internal',
    proposals: [{ ...proposal, id: 'draft', owner_id: 'voter', state: 'draft', electorate: null }],
  });
  const request = vi.fn(async (_type, input) =>
    input.action === 'session' ? session : { baseDocument: { nodes: [] } }
  );
  render(<Harness request={request} workspaceId="draft" />);
  await screen.findByRole('button', { name: 'Internal Suggestions' });
  expect(screen.getByTestId('read-only-reason').textContent).toBe('');
  expect(screen.getByTestId('editor-allowed').textContent).toBe('true');
});

it('locks an ordinary draft immediately when the procedure enters voting', async () => {
  const session = procedureSession({
    phase: 'vote_internal',
    proposals: [{ ...proposal, id: 'draft', owner_id: 'voter', state: 'draft', electorate: null }],
  });
  const request = vi.fn(async (_type, input) =>
    input.action === 'session' ? session : { baseDocument: { nodes: [] } }
  );
  render(<Harness request={request} workspaceId="draft" canEdit />);
  await screen.findByRole('button', { name: /Internal Voting/ });
  expect(screen.getByTestId('editor-allowed').textContent).toBe('false');
  expect(screen.getByTestId('read-only-reason').textContent).toBe('proposalDraftReadOnly');
});

it.each(['edit', 'suggest_internal', 'vote_internal'] as const)(
  'restricts personal AI direct decisions in %s',
  async phase => {
    const ai = {
      ...proposal,
      origin: 'ai' as const,
      owner_id: 'voter',
      state: 'draft' as const,
      electorate: null,
    };
    const session = procedureSession({ phase, proposals: [ai] });
    const request = vi.fn(async (_type, input) =>
      input.action === 'session'
        ? session
        : input.action === 'loadDraft'
          ? { document: { nodes: [] } }
          : { ok: true }
    );
    render(<Harness request={request} />);
    await screen.findByText('New introduction');
    fireEvent.click(screen.getByRole('button', { name: 'Open marker' }));
    await screen.findByRole('region', { name: 'Änderungsantrag' });
    expect(!!screen.queryByRole('button', { name: 'Annehmen' })).toBe(phase === 'edit');
    expect(!!screen.queryByRole('button', { name: 'Ablehnen' })).toBe(phase === 'edit');
  }
);

it('preserves canonical comments, revision history and group adoption in the shared tools', async () => {
  const session = procedureSession({
    comments: [
      {
        id: 'comment',
        author_id: 'voter',
        proposal_id: null,
        element_id: null,
        body: 'Canonical discussion',
        resolved: false,
      },
    ],
    revisions: [{ id: 'history', revision: 0, created_at: 0 }],
    adoptionGroups: [{ id: 'group', name: 'Destination' }],
  });
  const request = vi.fn(async (type, input) =>
    type === 'load' ? { revision: 0 } : input.action === 'session' ? session : { ok: true }
  );
  render(<Harness request={request} showTools />);
  await screen.findByText('Canonical discussion');
  fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Kommentar bearbeiten' }), {
    target: { value: 'Revised discussion' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      'canvas',
      expect.objectContaining({
        action: 'editComment',
        commentId: 'comment',
        body: 'Revised discussion',
      })
    )
  );
  fireEvent.click(screen.getByText('Versionsverlauf'));
  fireEvent.click(screen.getByRole('button', { name: 'Als neue Fassung wiederherstellen' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      'canvas',
      expect.objectContaining({ action: 'restore', historyId: 'history', revision: 0 })
    )
  );
  expect(screen.getByText('In einen Gruppenbereich übernehmen')).toBeTruthy();
});

it('shares a private draft with personal project participants through the shared proposal card', async () => {
  const session = procedureSession({
    phase: 'suggest_internal',
    proposals: [{ ...proposal, owner_id: 'voter', state: 'draft', electorate: null }],
    members: [{ id: 'reader', first_name: 'Invited', last_name: 'Reader' }],
  });
  const request = vi.fn(async (_type, input) =>
    input.action === 'session'
      ? session
      : input.action === 'loadDraft'
        ? { baseDocument: { nodes: [] } }
        : { ok: true }
  );
  render(<Harness request={request} workspaceId="proposal" />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Invited Reader' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      'canvas',
      expect.objectContaining({ action: 'share', workspaceId: 'proposal', userIds: ['reader'] })
    )
  );
});

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
  workspaceId,
  value,
  canEdit = true,
  showTools = false,
}: {
  request: ReturnType<typeof vi.fn>;
  chooseWorkspace?: (id?: string) => void;
  workspaceId?: string;
  value?: StudioDocumentV3;
  canEdit?: boolean;
  showTools?: boolean;
}) {
  const procedure = useStudioProcedure({
    projectId: 'project',
    workspaceId,
    chooseWorkspace,
    c: {
      actions: { request },
      commit: vi.fn().mockResolvedValue(0),
      selected: [],
      canEdit,
      assets: [],
      v3Value: value ?? { nodes: [] },
    } as never,
  });
  return (
    <div>
      <Toolbar>{procedure.modeButton}</Toolbar>
      <div>{procedure.canvasOverlay}</div>
      {showTools && <div>{procedure.tools}</div>}
      <span data-testid="read-only-reason">{procedure.readOnlyReason}</span>
      <button onClick={() => procedure.selectProposal('proposal')}>Open marker</button>
      <span data-testid="marker-count">{procedure.markers.length}</span>
      <span data-testid="marker-tones">
        {procedure.markers.map(marker => `${marker.proposalId}:${marker.tone}`).join(',')}
      </span>
      <span data-testid="preview-state">{procedure.previewDocument?.title ?? 'canonical'}</span>
      <span data-testid="editor-allowed">{String(procedure.editingAllowed)}</span>
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
    canEditProject: true,
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
    canEditProject: true,
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
    canEditProject: true,
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

it('marks private draft additions immediately against its protected base document', async () => {
  const base = createStudioTemplateDocumentV5('single', 'Draft base', defaultBrand);
  const draft = structuredClone(base);
  const added = structuredClone(base.nodes.find(node => node.type === 'shape')!);
  added.id = crypto.randomUUID();
  draft.nodes.push(added);
  const session = {
    canEditProject: true,
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
    proposals: [{ ...proposal, id: 'draft', owner_id: 'voter', state: 'draft', changes: null }],
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
        ? { document: draft, baseDocument: base }
        : []
  );
  render(<Harness request={request} workspaceId="draft" value={draft} />);
  await waitFor(() => expect(screen.getByTestId('marker-tones').textContent).toBe('draft:add'));
  expect(screen.getByRole('button', { name: 'Differenz' }).getAttribute('aria-pressed')).toBe(
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Original' }));
  expect(screen.getByTestId('marker-count').textContent).toBe('0');
  expect(screen.getByTestId('editor-allowed').textContent).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Vorschlag' }));
  expect(screen.getByTestId('marker-count').textContent).toBe('0');
  expect(screen.getByTestId('editor-allowed').textContent).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Differenz' }));
  expect(screen.getByTestId('marker-count').textContent).toBe('1');
  expect(screen.getByTestId('editor-allowed').textContent).toBe('true');
  expect(request).toHaveBeenCalledWith(
    'canvas',
    expect.objectContaining({ action: 'loadDraft', workspaceId: 'draft' })
  );
});

it('keeps all visible proposal markers while switching the selected canvas preview', async () => {
  const base = createStudioTemplateDocumentV5('single', 'Preview base', defaultBrand);
  const proposed = structuredClone(base);
  proposed.title = 'After preview';
  const removed = base.nodes.find(node => node.type === 'shape')!;
  proposed.nodes = proposed.nodes.filter(node => node.id !== removed.id);
  const changes = diffStudio(base, proposed);
  const session = {
    canEditProject: true,
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
    proposals: [
      { ...proposal, id: 'proposal', state: 'submitted', changes },
      { ...proposal, id: 'second', state: 'submitted', changes },
    ],
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
        ? { document: proposed, baseDocument: base }
        : []
  );
  render(<Harness request={request} value={base} />);
  await waitFor(() =>
    expect(screen.getByTestId('marker-tones').textContent).toBe('proposal:remove,second:remove')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open marker' }));
  const difference = await screen.findByRole('button', { name: 'Differenz' });
  await waitFor(() =>
    expect(screen.getByTestId('preview-state').textContent).toBe('After preview')
  );
  expect(difference.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('marker-count').textContent).toBe('2');
  fireEvent.click(screen.getByRole('button', { name: 'Original' }));
  expect(screen.getByTestId('preview-state').textContent).toBe('Preview base');
  expect(screen.getByTestId('marker-count').textContent).toBe('0');
  expect(screen.getByRole('button', { name: 'Original' }).getAttribute('aria-pressed')).toBe(
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Vorschlag' }));
  expect(screen.getByTestId('preview-state').textContent).toBe('After preview');
  expect(screen.getByTestId('marker-count').textContent).toBe('0');
  expect(screen.getByRole('button', { name: 'Vorschlag' }).getAttribute('aria-pressed')).toBe(
    'true'
  );
  fireEvent.click(difference);
  expect(screen.getByTestId('marker-count').textContent).toBe('2');
});
