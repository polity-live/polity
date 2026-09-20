/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollaborationClient } from '../hooks/useCollaborationDocument';
const api = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useCollaborationDocument', () => ({ collaborationRequest: api }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (_key: string, params: any, fallback?: string) =>
      typeof params === 'string'
        ? params
        : Object.entries(params).reduce(
            (text, [key, value]) => text.replace('{{' + key + '}}', String(value)),
            fallback || ''
          ),
  }),
}));
vi.mock('@/features/shared/ui/kit-platejs/editor-kit', () => ({
  EditorKitWithoutFixedToolbar: [],
}));
import { CollaborationStatus } from '../ui/CollaborationStatus';
import { ProposalViews } from '../ui/ProposalViews';
import { RecoveryPanel } from '../ui/RecoveryPanel';

function client(overrides: Partial<CollaborationClient> = {}): CollaborationClient {
  return {
    phase: 'active',
    status: 'saved',
    canEdit: true,
    error: null,
    session: {
      id: 'doc',
      generation: 'current',
      revision: 4,
      reference: { kind: 'document', entityId: 'entity', branchId: null, workspaceId: null },
      capabilities: {
        read: true,
        edit: true,
        suggest: true,
        comment: true,
        vote: false,
        manage: true,
      },
    },
    value: [{ text: 'Server content' }],
    recoveries: [],
    workspaces: [],
    commit: vi.fn().mockResolvedValue({ id: 'doc', generation: 'current', revision: 5 }),
    reload: vi.fn(),
    submit: vi.fn().mockResolvedValue(undefined),
    createDraft: vi.fn().mockResolvedValue(undefined),
    selectWorkspace: vi.fn(),
    share: vi.fn().mockResolvedValue(undefined),
    exportRecovery: vi.fn(),
    ...overrides,
  } as unknown as CollaborationClient;
}
beforeEach(() => {
  api.mockReset();
});
afterEach(cleanup);

describe('shared workspace and recovery controls', () => {
  it('keeps workspace selection usable without a loaded session and handles a rejected submission', async () => {
    const c = client({
      session: null,
      workspaces: [{ id: 'draft', type: 'proposal', owner: true, shared: false, frozen: false }],
    });
    const view = render(<CollaborationStatus client={c} />);
    expect((screen.getByRole('combobox', { name: 'Workspace' }) as HTMLSelectElement).value).toBe(
      ''
    );
    const writable = client({ submit: vi.fn().mockRejectedValue(new Error('revision_changed')) });
    writable.session!.reference.workspaceId = 'draft';
    view.rerender(<CollaborationStatus client={writable} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit proposal' })));
    expect(writable.submit).toHaveBeenCalledOnce();
  });
  it.each(['resolve', 'reject'])(
    'discards a late proposal %s after the workspace is left',
    async outcome => {
      let finish!: (value: any) => void;
      api.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finish = outcome === 'resolve' ? resolve : reject;
          })
      );
      const view = render(<ProposalViews client={client()} />);
      view.rerender(<ProposalViews client={client({ phase: 'maintenance', session: null })} />);
      await act(async () => {
        finish(
          outcome === 'resolve'
            ? [{ id: 'private', title: 'Old private proposal' }]
            : new Error('Old denial')
        );
      });
      expect(screen.queryByText(/Old private proposal|Old denial/)).toBeNull();
    }
  );
  it('deduplicates clicks before the pending state renders and tolerates an unavailable local draft', async () => {
    let finish!: (reason: Error) => void;
    const c = client({
      recoveries: ['old'],
      inspectRecovery: vi.fn(
        () =>
          new Promise<{ base: unknown; local: unknown }>((_resolve, reject) => {
            finish = reject;
          })
      ),
    });
    const view = render(<RecoveryPanel client={c} />);
    const button = screen.getByRole('button', { name: 'Lokalen Entwurf 1 vergleichen' });
    act(() => {
      button.click();
      button.click();
    });
    expect(c.inspectRecovery).toHaveBeenCalledOnce();
    await act(async () => finish(new Error('recovery_not_found')));
    expect(screen.getByRole('alert').textContent).toBe('recovery_not_found');
    expect(screen.queryByText('Wiederaufnahme als neuer privater Entwurf')).toBeNull();
    view.rerender(<RecoveryPanel client={{ ...c, inspectRecovery: undefined }} />);
    await act(async () => fireEvent.click(button));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('shows maintenance and explicit errors before a session is available', () => {
    const c = client({ phase: 'maintenance', status: 'loading', session: null });
    const view = render(<CollaborationStatus client={c} />);
    expect(screen.getByRole('status').textContent).toContain('loading');
    view.rerender(
      <CollaborationStatus client={{ ...c, phase: 'error', error: 'generation_changed' }} />
    );
    expect(screen.getByRole('status').textContent).toContain('generation_changed');
  });
  it('waits for the current server session before comparing a retained local draft', async () => {
    const c = client({
      recoveries: ['old'],
      inspectRecovery: vi.fn().mockResolvedValue({ base: 'a', local: 'b' }),
    });
    const view = render(<RecoveryPanel client={{ ...c, phase: 'loading', session: null }} />);
    const compare = screen.getByRole('button', { name: 'Lokalen Entwurf 1 vergleichen' });
    fireEvent.click(compare);
    expect(c.inspectRecovery).not.toHaveBeenCalled();
    expect((compare as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<RecoveryPanel client={{ ...c, session: null }} />);
    expect((compare as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<RecoveryPanel client={c} />);
    fireEvent.click(compare);
    expect(await screen.findByText('"b"')).toBeTruthy();
    expect(screen.getByText(/"text": "Server content"/)).toBeTruthy();
  });
  it('offers draft creation and hides procedural success when creation, publishing or sharing is denied', async () => {
    const c = client();
    vi.mocked(c.createDraft).mockRejectedValueOnce(new Error('phase_changed'));
    const view = render(<CollaborationStatus client={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a separate draft' }));
    await waitFor(() => expect(c.reload).toHaveBeenCalledOnce());
    expect(c.createDraft).toHaveBeenCalledWith('followup');
    c.session!.reference.workspaceId = 'draft';
    c.session!.draftAction = 'publish';
    c.workspaces = [{ id: 'draft', type: 'followup', owner: true, shared: true, frozen: false }];
    vi.mocked(c.submit).mockRejectedValueOnce(new Error('denied'));
    vi.mocked(c.share!).mockRejectedValueOnce(new Error('denied'));
    view.rerender(<CollaborationStatus client={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make draft private' }));
    await waitFor(() => expect(c.submit).toHaveBeenCalledOnce());
    expect(c.share).toHaveBeenCalledWith(false);
    expect(c.reload).toHaveBeenCalledOnce();
  });
  it('reports a failed integrity repair and refuses a late click after its session disappears', async () => {
    const c = client({ canEdit: false });
    c.session!.integrityError = 'checksum_mismatch';
    api.mockRejectedValue(new Error('repair_denied'));
    const view = render(<CollaborationStatus client={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Geprüfte Fassung wiederherstellen' }));
    expect((await screen.findByRole('alert')).textContent).toBe('repair_denied');
    expect(c.reload).not.toHaveBeenCalled();
    c.session = null;
    fireEvent.click(screen.getByRole('button', { name: 'Geprüfte Fassung wiederherstellen' }));
    expect(api).toHaveBeenCalledTimes(1);
    view.rerender(<CollaborationStatus client={c} />);
    expect(screen.queryByText('Geprüfte Fassung wiederherstellen')).toBeNull();
  });
  it('keeps failed offline comparisons downloadable and permits a deliberate retry after inspection completes', async () => {
    let reject: (reason: Error) => void = () => {
      throw new Error('Request has not started');
    };
    const c = client({
      recoveries: ['old'],
      inspectRecovery: vi.fn(
        () =>
          new Promise<{ base: unknown; local: unknown }>((_resolve, fail) => {
            reject = fail;
          })
      ),
    });
    render(<RecoveryPanel client={c} />);
    const compare = screen.getByRole('button', { name: 'Lokalen Entwurf 1 vergleichen' });
    fireEvent.click(compare);
    expect((compare as HTMLButtonElement).disabled).toBe(true);
    reject(new Error('Local draft could not be read'));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Local draft could not be read'
    );
    expect((compare as HTMLButtonElement).disabled).toBe(false);
    expect(c.recoveries).toEqual(['old']);
  });
  it('retains the comparison when renewed resume permission is denied and never overwrites the server', async () => {
    const c = client({
      recoveries: ['old'],
      inspectRecovery: vi.fn().mockResolvedValue({ base: 'a', local: 'b' }),
    });
    api
      .mockResolvedValueOnce({ id: 'doc', generation: 'current', revision: 6 })
      .mockRejectedValueOnce(new Error('access_denied'));
    render(<RecoveryPanel client={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lokalen Entwurf 1 vergleichen' }));
    const resume = await screen.findByRole('button', { name: 'Als neuen Entwurf wiederaufnehmen' });
    await waitFor(() => expect((resume as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(resume);
    expect((resume as HTMLButtonElement).disabled).toBe(true);
    expect((await screen.findByRole('alert')).textContent).toContain('access_denied');
    expect(screen.getByText('"b"')).toBeTruthy();
    expect(c.selectWorkspace).not.toHaveBeenCalled();
    expect(c.commit).not.toHaveBeenCalled();
  });
  it('reports rejected rebase and history reads while keeping the existing draft and server content', async () => {
    const c = client();
    c.session!.reference.workspaceId = 'draft';
    api.mockRejectedValue(new Error('access_denied'));
    const ui = render(<RecoveryPanel client={c} />);
    const rebase = screen.getByRole('button', { name: 'Entwurf auf aktuellen Haupttext beziehen' });
    fireEvent.click(rebase);
    expect((rebase as HTMLButtonElement).disabled).toBe(true);
    expect((await screen.findByRole('alert')).textContent).toContain('access_denied');
    expect(c.reload).not.toHaveBeenCalled();
    c.session!.reference.workspaceId = null;
    ui.rerender(<RecoveryPanel client={c} />);
    fireEvent.click(screen.getByText('Gespeicherte Fassungen'));
    fireEvent.click(screen.getByRole('button', { name: 'Fassungen laden' }));
    expect((await screen.findByRole('alert')).textContent).toContain('access_denied');
    expect(screen.queryByText('Als neue Generation wiederherstellen')).toBeNull();
  });
  it('waits for one restore confirmation, prevents duplicate clicks and withholds restore from read-only users', async () => {
    const c = client();
    let confirm: (value: unknown) => void = () => {
      throw new Error('Request has not started');
    };
    api.mockImplementation((operation: string) =>
      operation === 'revisions'
        ? Promise.resolve([{ id: 'old', revision: 1, reason: 'edit', projection: 'Historical' }])
        : operation === 'read'
          ? Promise.resolve({ id: 'doc', generation: 'current', revision: 4 })
          : new Promise(resolve => {
              confirm = resolve;
            })
    );
    const ui = render(<RecoveryPanel client={c} />);
    fireEvent.click(screen.getByText('Gespeicherte Fassungen'));
    fireEvent.click(screen.getByRole('button', { name: 'Fassungen laden' }));
    const button = await screen.findByRole('button', {
      name: 'Als neue Generation wiederherstellen',
    });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(api.mock.calls.filter(([op]) => op === 'restore')).toHaveLength(1));
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Serverbestätigung');
    confirm({ revision: 5 });
    await waitFor(() => expect(c.reload).toHaveBeenCalledOnce());
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    c.canEdit = false;
    ui.rerender(<RecoveryPanel client={c} />);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    c.session!.capabilities.manage = false;
    ui.rerender(<RecoveryPanel client={c} />);
    expect(screen.queryByText('Gespeicherte Fassungen')).toBeNull();
  });
  it('keeps local, original and server content separate and resumes only into a newly authorized draft', async () => {
    const c = client({
      recoveries: ['old-user-document-generation'],
      inspectRecovery: vi
        .fn()
        .mockResolvedValue({ base: 'Original content', local: 'Offline content' }),
    });
    api
      .mockResolvedValueOnce({ id: 'doc', generation: 'current', revision: 7 })
      .mockResolvedValueOnce({ workspaceId: 'new-private-draft' });
    render(<RecoveryPanel client={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lokalen Entwurf 1 vergleichen' }));
    await screen.findByText('Wiederaufnahme als neuer privater Entwurf');
    expect(screen.getByText('"Original content"')).toBeTruthy();
    expect(screen.getByText('"Offline content"')).toBeTruthy();
    expect(screen.getByText(/Server content/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Als neuen Entwurf wiederaufnehmen' }));
    await waitFor(() => expect(c.selectWorkspace).toHaveBeenCalledWith('new-private-draft'));
    expect(api).toHaveBeenNthCalledWith(
      2,
      'resume',
      expect.objectContaining({
        id: 'doc',
        generation: 'current',
        expectedRevision: 7,
        value: 'Offline content',
        operationId: expect.any(String),
      })
    );
    expect(c.commit).not.toHaveBeenCalled();
    expect(screen.queryByText('Wiederaufnahme als neuer privater Entwurf')).toBeNull();
  });
  it('offers an offline download and comparison after revocation but never offers to submit or overwrite', async () => {
    const c = client({
      status: 'offline',
      canEdit: false,
      recoveries: ['old-draft'],
      inspectRecovery: vi.fn().mockResolvedValue({ base: 'a', local: 'b' }),
    });
    c.session!.capabilities = {
      read: true,
      edit: false,
      suggest: false,
      manage: false,
      comment: false,
      vote: false,
    };
    render(<CollaborationStatus client={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download earlier local draft 1' }));
    expect(c.exportRecovery).toHaveBeenCalledWith('old-draft');
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect; keep local draft' }));
    expect(c.reload).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Lokalen Entwurf 1 vergleichen' }));
    await screen.findByText('Wiederaufnahme als neuer privater Entwurf');
    expect(screen.queryByText('Als neuen Entwurf wiederaufnehmen')).toBeNull();
    expect(screen.queryByText('Submit proposal')).toBeNull();
    expect(screen.queryByText('Create a separate draft')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByText('Wiederaufnahme als neuer privater Entwurf')).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });
  it('restores a displayed historical version using the freshly confirmed revision and reports a rejected command', async () => {
    const c = client();
    api
      .mockResolvedValueOnce([
        { id: 'archive', revision: 2, reason: 'edit', projection: 'Historical text' },
      ])
      .mockResolvedValueOnce({ id: 'doc', generation: 'current', revision: 9 })
      .mockRejectedValueOnce(new Error('revision_changed'));
    render(<RecoveryPanel client={c} />);
    fireEvent.click(screen.getByText('Gespeicherte Fassungen'));
    fireEvent.click(screen.getByRole('button', { name: 'Fassungen laden' }));
    await screen.findByText('Revision 2 · edit');
    fireEvent.click(screen.getByRole('button', { name: 'Als neue Generation wiederherstellen' }));
    expect((await screen.findByRole('alert')).textContent).toContain('revision_changed');
    expect(api).toHaveBeenNthCalledWith(
      3,
      'restore',
      expect.objectContaining({ expectedRevision: 9, value: 'Historical text' })
    );
    expect(c.reload).not.toHaveBeenCalled();
  });
  it('waits for a confirmed draft commit before rebase and reloads only after success', async () => {
    const c = client();
    c.session!.reference.workspaceId = 'private-draft';
    api.mockResolvedValue({ revision: 6 });
    render(<RecoveryPanel client={c} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Entwurf auf aktuellen Haupttext beziehen' })
    );
    await waitFor(() => expect(c.reload).toHaveBeenCalledOnce());
    expect(c.commit).toHaveBeenCalledOnce();
    expect(api).toHaveBeenCalledWith(
      'rebase',
      expect.objectContaining({ expectedRevision: 5, generation: 'current' })
    );
  });
  it('keeps frozen drafts read-only while permitting workspace selection', () => {
    const c = client({
      canEdit: false,
      workspaces: [{ id: 'submitted', type: 'proposal', owner: true, shared: false, frozen: true }],
    });
    c.session!.reference.workspaceId = 'submitted';
    render(<CollaborationStatus client={c} />);
    expect(screen.queryByText('Submit proposal')).toBeNull();
    expect(screen.queryByText('Share with eligible collaborators')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Workspace' }), {
      target: { value: '' },
    });
    expect(c.selectWorkspace).toHaveBeenCalledWith(null);
  });
  it('allows a private draft owner to share, submit and return to main without exposing legacy controls', () => {
    const c = client({
      workspaces: [{ id: 'draft', type: 'proposal', owner: true, shared: false, frozen: false }],
    });
    c.session!.reference.workspaceId = 'draft';
    const view = render(<CollaborationStatus client={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share with eligible collaborators' }));
    expect(c.share).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Submit proposal' }));
    expect(c.submit).toHaveBeenCalledOnce();
    view.rerender(<CollaborationStatus client={{ ...c, phase: 'legacy' }} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('shows the last verified revision and restricts repair to managers', async () => {
    const c = client({ canEdit: false });
    c.session!.integrityError = 'checksum_mismatch';
    c.session!.readableRevision = 3;
    c.session!.capabilities.edit = false;
    c.session!.capabilities.suggest = false;
    api.mockResolvedValue({ revision: 5 });
    const view = render(<CollaborationStatus client={c} />);
    expect(screen.getByText(/Letzte geprüfte Fassung: Revision 3/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Geprüfte Fassung wiederherstellen' }));
    await waitFor(() => expect(c.reload).toHaveBeenCalledOnce());
    expect(api).toHaveBeenCalledWith(
      'repair',
      expect.objectContaining({ expectedRevision: 4, generation: 'current' })
    );
    c.session!.capabilities.manage = false;
    view.rerender(<CollaborationStatus client={c} />);
    expect(screen.queryByText('Geprüfte Fassung wiederherstellen')).toBeNull();
  });
});

describe('decision application controls', () => {
  it('renders the authorized submitted preview as read-only and clears it on workspace switches', async () => {
    const c = client();
    api.mockResolvedValue([
      {
        id: 'proposal',
        title: 'Vorschau',
        preview: [{ type: 'p', children: [{ text: 'Eingereichter Inhalt' }] }],
        applicationStatus: 'pending',
        canResolve: false,
      },
    ]);
    const view = render(<ProposalViews client={c} />);
    await screen.findByText('Eingereichter Inhalt');
    expect(
      view.container.querySelector('[data-slate-editor]')?.getAttribute('contenteditable')
    ).toBe('false');
    expect(c.commit).not.toHaveBeenCalled();
    view.rerender(
      <ProposalViews
        client={{
          ...c,
          session: {
            ...c.session!,
            id: 'draft',
            reference: { ...c.session!.reference, workspaceId: 'private' },
          },
        }}
      />
    );
    await waitFor(() => expect(screen.queryByText('Eingereichter Inhalt')).toBeNull());
  });
  it('reads the authoritative revision when a manager may decide but the proposal phase prevents direct text edits', async () => {
    const c = client({ canEdit: false });
    c.session!.capabilities.edit = false;
    api
      .mockResolvedValueOnce([
        {
          id: 'proposal',
          title: 'Entscheiden',
          preview: null,
          decisionResult: null,
          applicationStatus: 'pending',
          canResolve: true,
        },
      ])
      .mockResolvedValueOnce({ id: 'doc', generation: 'current', revision: 12 })
      .mockResolvedValueOnce({ applicationStatus: 'applied' });
    render(<ProposalViews client={c} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ablehnen' }));
    await waitFor(() => expect(c.reload).toHaveBeenCalledOnce());
    expect(c.commit).not.toHaveBeenCalled();
    expect(api).toHaveBeenNthCalledWith(2, 'read', { id: 'doc', generation: 'current' });
    expect(api).toHaveBeenLastCalledWith(
      'resolve',
      expect.objectContaining({ result: 'rejected', expectedRevision: 12 })
    );
  });
  it('keeps submitted content and decision status visible when resolve or retry fails', async () => {
    const c = client();
    api
      .mockResolvedValueOnce([
        {
          id: 'proposal',
          title: null,
          preview: null,
          decisionResult: null,
          applicationStatus: 'pending',
          canResolve: true,
        },
      ])
      .mockRejectedValueOnce(new Error('decision_denied'));
    const view = render(<ProposalViews client={c} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Annehmen' }));
    expect((await screen.findByRole('alert')).textContent).toContain('decision_denied');
    expect(c.reload).not.toHaveBeenCalled();
    api
      .mockResolvedValueOnce([
        {
          id: 'proposal',
          title: 'Entschieden',
          preview: null,
          decisionResult: 'accepted',
          applicationStatus: 'conflict',
          canResolve: false,
        },
      ])
      .mockRejectedValueOnce(new Error('phase_changed'));
    view.rerender(
      <ProposalViews client={{ ...c, session: { ...c.session!, generation: 'new' } }} />
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Anwendung erneut prüfen' }));
    expect((await screen.findByRole('alert')).textContent).toContain('phase_changed');
    expect(screen.getByText('Entschieden · accepted · conflict')).toBeTruthy();
    view.rerender(<ProposalViews client={{ ...c, phase: 'maintenance' }} />);
    await waitFor(() => expect(screen.queryByText('Entschieden · accepted · conflict')).toBeNull());
  });
  it('shows decision actions from current server authority rather than text editing permission', async () => {
    const c = client();
    api.mockResolvedValueOnce([
      {
        id: 'proposal',
        title: 'Submitted',
        preview: null,
        decisionResult: null,
        applicationStatus: 'pending',
        canResolve: false,
      },
    ]);
    const view = render(<ProposalViews client={c} />);
    await screen.findByText('Submitted · Eingereicht · pending');
    expect(screen.queryByRole('button', { name: 'Annehmen' })).toBeNull();
    api.mockResolvedValueOnce([
      {
        id: 'proposal',
        title: 'Submitted',
        preview: null,
        decisionResult: null,
        applicationStatus: 'pending',
        canResolve: true,
      },
    ]);
    view.rerender(
      <ProposalViews
        client={{
          ...c,
          session: {
            ...c.session!,
            generation: 'new',
            capabilities: { ...c.session!.capabilities, edit: false },
          },
        }}
      />
    );
    expect(await screen.findByRole('button', { name: 'Annehmen' })).toBeTruthy();
  });
  const conflict = {
    id: 'cr',
    title: 'Mehr Grün',
    preview: null,
    previewConflict: true,
    decisionResult: 'passed',
    applicationStatus: 'conflict',
    conflictReason: 'changed_target',
  };
  it('retains the recorded decision while retrying application against the current server revision', async () => {
    const c = client();
    api
      .mockResolvedValueOnce([conflict])
      .mockResolvedValueOnce({ revision: 11 })
      .mockResolvedValueOnce({ status: 'conflict' });
    render(<ProposalViews client={c} />);
    fireEvent.click(await screen.findByText('Mehr Grün · passed · conflict'));
    expect(screen.getByRole('alert').textContent).toContain('Die Entscheidung bleibt erhalten');
    expect(screen.queryByText('Annehmen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Anwendung erneut prüfen' }));
    await waitFor(() => expect(c.reload).toHaveBeenCalledOnce());
    expect(api).toHaveBeenNthCalledWith(
      3,
      'retryDecision',
      expect.objectContaining({ changeRequestId: 'cr', expectedRevision: 11 })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Änderungsantrag entwerfen' }));
    expect(c.createDraft).toHaveBeenCalledWith('proposal');
    expect(c.commit).not.toHaveBeenCalled();
  });
  it('removes proposal data after a denied read and offers no decision actions to a reader', async () => {
    const c = client({ canEdit: false });
    c.session!.capabilities = {
      read: true,
      edit: false,
      suggest: false,
      manage: false,
      comment: false,
      vote: false,
    };
    api.mockResolvedValueOnce([conflict]);
    const view = render(<ProposalViews client={c} />);
    await screen.findByText('Mehr Grün · passed · conflict');
    expect(screen.queryByRole('button')).toBeNull();
    api.mockRejectedValueOnce(new Error('access_denied'));
    view.rerender(
      <ProposalViews client={{ ...c, session: { ...c.session!, generation: 'revoked' } }} />
    );
    await screen.findByText('access_denied');
    expect(screen.queryByText('Mehr Grün · passed · conflict')).toBeNull();
  });
  it('confirms pending edits before resolving a proposal and never sends preview content as the decision', async () => {
    const c = client();
    api
      .mockResolvedValueOnce([
        {
          ...conflict,
          decisionResult: null,
          conflictReason: null,
          applicationStatus: 'pending',
          canResolve: true,
        },
      ])
      .mockResolvedValueOnce({ status: 'applied' });
    render(<ProposalViews client={c} />);
    fireEvent.click(await screen.findByText('Mehr Grün · Eingereicht · pending'));
    fireEvent.click(await screen.findByRole('button', { name: 'Annehmen' }));
    await waitFor(() => expect(c.reload).toHaveBeenCalledOnce());
    expect(api).toHaveBeenLastCalledWith(
      'resolve',
      expect.objectContaining({ result: 'accepted', expectedRevision: 5, changeRequestId: 'cr' })
    );
    expect(api.mock.calls.at(-1)![1]).not.toHaveProperty('content');
  });
});
