import { studioClientFixture } from '@/test/studio-client.fixture';
/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Toolbar } from '@/features/shared/ui/layout';
import { useStudioProcedure, proposalNodeIds } from '../useStudioProcedure';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { diffStudio } from '../../logic/operations';

const io = vi.hoisted(() => ({
  user: { id: '00000000-0000-4000-a000-000000000008' } as { id: string } | null,
  session: null as any,
  controller: null as any,
  procedure: null as any,
  base: null as any,
  proposed: null as any,
  assets: [] as any[],
  request: vi.fn(),
  commit: vi.fn(),
  choose: vi.fn(),
  auth: vi.fn(),
  fetch: vi.fn(),
  response: {} as any,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: io.user }) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: io.auth } }),
}));
function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-a000-000000000003',
    title: 'Proposed introduction',
    reason: 'Clearer wording',
    owner_id: '00000000-0000-4000-a000-000000000008',
    shared_ids: [],
    revision: 4,
    base_revision: 1,
    state: 'draft',
    decision: null,
    application: 'pending',
    resolves_id: null,
    deadline: null,
    electorate: null,
    votes: [],
    changes: [],
    ...overrides,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.lang = 'en';
  window.history.replaceState(null, '', '/');
  io.user = { id: '00000000-0000-4000-a000-000000000008' };
  io.base = createStudioTemplateDocumentV5('single', 'Base', defaultBrand);
  io.proposed = structuredClone(io.base);
  io.session = {
    canEditProject: true,
    groupId: '00000000-0000-4000-a000-000000000004',
    phase: 'edit',
    generation: '00000000-0000-4000-a000-000000000001',
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
  };
  io.assets = [];
  io.response = {};
  io.commit.mockResolvedValue(7);
  io.auth.mockResolvedValue({ data: { session: { access_token: 'fixture-token' } } });
  io.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(['fixture']) });
  vi.stubGlobal('fetch', io.fetch);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  io.request.mockImplementation(async (operation, input) => {
    if (operation === 'load') return { revision: 11 };
    if (operation === 'assets') return io.assets;
    if (input.action === 'session') return io.session;
    if (input.action === 'loadDraft') return { document: io.proposed, baseDocument: io.base };
    return io.response;
  });
  io.controller = {
    actions: studioClientFixture(io),
    commit: io.commit,
    selected: [],
    canEdit: true,
    assets: [],
    v3Value: io.base,
    status: 'saved',
    busy: false,
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function Harness({ workspaceId }: { workspaceId?: string }) {
  const p = useStudioProcedure({
    projectId: '00000000-0000-4000-a000-000000000002',
    workspaceId,
    chooseWorkspace: io.choose,
    c: io.controller,
  });
  io.procedure = p;
  return (
    <>
      <Toolbar>{p.modeButton}</Toolbar>
      {p.tools}
      {p.canvasOverlay}
      <button onClick={() => p.selectProposal('00000000-0000-4000-a000-000000000003')}>
        Open proposal
      </button>
      <output data-testid="preview">{p.previewDocument?.title ?? 'canonical'}</output>
    </>
  );
}
const command = (action: string, input: Record<string, unknown>) =>
  expect(io.request).toHaveBeenCalledWith(
    'canvas',
    expect.objectContaining({
      projectId: '00000000-0000-4000-a000-000000000002',
      generation: '00000000-0000-4000-a000-000000000001',
      operationId: expect.any(String),
      action,
      ...input,
    })
  );

it('creates a trimmed suggestion after committing the editor and rejects an empty form', async () => {
  io.session.phase = 'suggest_internal';
  io.response = { workspaceId: 'created' };
  render(<Harness />);
  const title = await screen.findByRole('textbox', { name: 'Proposal title' });
  fireEvent.submit(title.closest('form')!);
  expect(io.commit).not.toHaveBeenCalled();
  fireEvent.change(title, { target: { value: '  Better wording  ' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Specific explanation' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Start proposal' }));
  await waitFor(() =>
    command('createDraft', { title: 'Better wording', reason: 'Specific explanation', revision: 7 })
  );
  await waitFor(() => expect(io.choose).toHaveBeenCalledExactlyOnceWith('created'));
});

it.each(['acceptPrivate', 'rejectPrivate'])(
  'decides an AI suggestion with %s against its own revision',
  async action => {
    io.session.groupId = null;
    io.session.proposals = [
      proposal({ origin: 'ai', ai_mode: 'free', ai_sources: ['source'], ai_warnings: ['Warning'] }),
    ];
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
    fireEvent.click(
      await screen.findByRole('button', { name: action === 'acceptPrivate' ? 'Accept' : 'Reject' })
    );
    await waitFor(() =>
      command(action, { workspaceId: '00000000-0000-4000-a000-000000000003', revision: 4 })
    );
    expect(io.commit).not.toHaveBeenCalled();
    expect(screen.getByText(/Free design/)).toBeTruthy();
    expect(screen.getByText(/Warning/)).toBeTruthy();
  }
);

it.each(['submit', 'withdraw'])(
  'executes the owned draft command %s and applies its workspace transition',
  async action => {
    io.session.phase = 'suggest_internal';
    io.session.proposals = [proposal()];
    render(<Harness workspaceId="00000000-0000-4000-a000-000000000003" />);
    fireEvent.click(
      await screen.findByRole('button', { name: action === 'submit' ? 'Submit' : 'Withdraw' })
    );
    await waitFor(() => command(action, { workspaceId: '00000000-0000-4000-a000-000000000003' }));
    if (action === 'submit') await waitFor(() => expect(io.choose).toHaveBeenCalledWith());
    else
      await waitFor(() =>
        expect(io.procedure.markers.every((marker: any) => !marker.selected)).toBe(true)
      );
  }
);

it('opens an editable shared draft and returns to the canonical workspace only after committing', async () => {
  io.session.proposals = [
    proposal({
      owner_id: '00000000-0000-4000-a000-000000000012',
      shared_ids: ['00000000-0000-4000-a000-000000000008'],
    }),
  ];
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit draft' }));
  expect(io.choose).toHaveBeenCalledWith('00000000-0000-4000-a000-000000000003');
  view.rerender(<Harness workspaceId="00000000-0000-4000-a000-000000000003" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Back to project' }));
  await waitFor(() => expect(io.commit).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(io.choose).toHaveBeenCalledWith());
});

it.each(['finalize', 'reapply', 'resolveDraft'])(
  'executes the managed resolution command %s against the correct protected revision',
  async action => {
    io.session.phase = 'vote_internal';
    io.session.proposals = [
      proposal({
        state: 'voting',
        application: 'conflict',
        electorate: ['00000000-0000-4000-a000-000000000008'],
        votes: [
          { user_id: '00000000-0000-4000-a000-000000000008', choice: 'accept' },
          { user_id: '00000000-0000-4000-a000-000000000012', choice: 'reject' },
          { user_id: 'third', choice: 'abstain' },
        ],
      }),
    ];
    io.response = { workspaceId: 'resolution' };
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
    const label =
      action === 'finalize'
        ? 'Finalize'
        : action === 'reapply'
          ? 'Retry decision'
          : 'Resolution proposal';
    fireEvent.click(await screen.findByRole('button', { name: label }));
    await waitFor(() =>
      command(action, {
        workspaceId: '00000000-0000-4000-a000-000000000003',
        ...(action === 'resolveDraft'
          ? { revision: 11, title: 'Resolution: Proposed introduction' }
          : {}),
      })
    );
    if (action === 'resolveDraft')
      await waitFor(() => expect(io.choose).toHaveBeenCalledWith('resolution'));
    expect(screen.getByText(/eligible voters have voted/).textContent).toContain('3/1');
  }
);

it.each(['accept', 'reject', 'abstain'])(
  'records the eligible voter choice %s and preserves the visible voting state',
  async choice => {
    io.session.phase = 'vote_internal';
    io.session.proposals = [
      proposal({
        state: 'voting',
        electorate: ['00000000-0000-4000-a000-000000000008'],
        votes: [],
      }),
    ];
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
    const label = choice === 'accept' ? 'Yes' : choice === 'reject' ? 'No' : 'Abstain';
    fireEvent.click(await screen.findByRole('button', { name: label }));
    await waitFor(() =>
      command('vote', { workspaceId: '00000000-0000-4000-a000-000000000003', choice })
    );
  }
);

it.each([true, false])(
  'shares and unshares the private draft with an explicit user identity (initially shared=%s)',
  async shared => {
    io.session.phase = 'suggest_internal';
    io.session.proposals = [
      proposal({ shared_ids: shared ? ['00000000-0000-4000-a000-000000000020'] : [] }),
    ];
    io.session.members = [
      { id: '00000000-0000-4000-a000-000000000008' },
      { id: '00000000-0000-4000-a000-000000000020' },
    ];
    render(<Harness workspaceId="00000000-0000-4000-a000-000000000003" />);
    fireEvent.click(
      await screen.findByRole('checkbox', { name: '00000000-0000-4000-a000-000000000020' })
    );
    await waitFor(() =>
      command('share', {
        workspaceId: '00000000-0000-4000-a000-000000000003',
        userIds: shared ? [] : ['00000000-0000-4000-a000-000000000020'],
        revision: 7,
      })
    );
    expect(
      screen.queryByRole('checkbox', { name: '00000000-0000-4000-a000-000000000008' })
    ).toBeNull();
  }
);

it('selects a linked proposal from the URL, compares changed rich text and closes its details', async () => {
  window.history.replaceState(null, '', '/?proposalId=00000000-0000-4000-a000-000000000003');
  const text = io.proposed.nodes.find((node: any) => node.type === 'richText');
  text.content = [{ type: 'p', children: [{ text: 'New introduction' }] }];
  io.session.proposals = [
    proposal({
      origin: 'ai',
      ai_mode: 'template',
      state: 'submitted',
      decision: 'accepted',
      changes: diffStudio(io.base, io.proposed),
    }),
  ];
  render(<Harness />);
  await screen.findByRole('region', { name: 'Change request' });
  await screen.findByRole('button', { name: 'Original' });
  fireEvent.click(screen.getByText(/Changes \(/));
  expect(screen.getByText(/Template/)).toBeTruthy();
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Change request' })).getByRole('button', {
      name: 'Close',
    })
  );
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Change request' })).toBeNull());
});

it.each(['success', 'missing-session', 'download-error'])(
  'hydrates proposal media securely and handles %s',
  async mode => {
    const media = { id: 'private-media', url: '/private-media', mime: 'image/png' };
    io.assets = [media];
    if (mode === 'missing-session') io.auth.mockResolvedValue({ data: { session: null } });
    if (mode === 'download-error') io.fetch.mockResolvedValue({ ok: false });
    io.session.proposals = [proposal({ state: 'submitted' })];
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
    if (mode === 'success') {
      await waitFor(() =>
        expect(io.procedure.previewAssets).toEqual([{ ...media, url: 'blob:fixture' }])
      );
      expect(io.fetch).toHaveBeenCalledWith('/private-media', {
        headers: { Authorization: 'Bearer fixture-token' },
      });
      cleanup();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
    } else {
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toContain(
          mode === 'missing-session' ? 'Please sign in' : 'Cannot load media'
        )
      );
      expect(io.procedure.previewAssets).toEqual([]);
      if (mode === 'missing-session') expect(io.fetch).not.toHaveBeenCalled();
    }
  }
);

it.each(['success', 'canonical', 'missing-session', 'download-error'])(
  'loads newly proposed ghost media and handles %s without duplicating canonical assets',
  async mode => {
    const asset = { id: 'ghost', url: '/ghost', mime: 'image/png' };
    io.assets = [asset, asset];
    io.session.proposals = [
      proposal({
        state: 'submitted',
        changes: [
          {
            path: ['nodes', '#new-media'],
            before: { exists: false },
            after: { exists: true, value: { type: 'media' } },
          },
        ],
      }),
    ];
    if (mode === 'canonical') io.controller.assets = [asset];
    if (mode === 'missing-session') io.auth.mockResolvedValue({ data: { session: null } });
    if (mode === 'download-error') io.fetch.mockResolvedValue({ ok: false });
    render(<Harness />);
    await screen.findByText(/Proposed introduction/);
    if (mode === 'success') {
      await waitFor(() =>
        expect(io.procedure.previewAssets).toEqual([{ ...asset, url: 'blob:fixture' }])
      );
      expect(io.fetch).toHaveBeenCalledTimes(1);
      cleanup();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
    } else if (mode === 'canonical') {
      await waitFor(() =>
        expect(io.request).toHaveBeenCalledWith('assets', {
          id: '00000000-0000-4000-a000-000000000002',
          workspaceId: '00000000-0000-4000-a000-000000000003',
        })
      );
      expect(io.fetch).not.toHaveBeenCalled();
      expect(io.procedure.previewAssets).toEqual([]);
    } else {
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toContain(
          mode === 'missing-session' ? 'Please sign in' : 'Cannot load media'
        )
      );
    }
  }
);

it('ignores malformed or missing proposal node paths and unchanged text comparisons', async () => {
  expect(proposalNodeIds(proposal({ changes: null }) as any)).toEqual([]);
  expect(
    proposalNodeIds(proposal({ changes: [{ path: ['nodes'] }, { path: ['title'] }] }) as any)
  ).toEqual([]);
  const text = io.base.nodes.find((node: any) => node.type === 'richText');
  io.session.proposals = [
    proposal({
      state: 'submitted',
      changes: [
        {
          path: ['nodes', `#${text.id}`, 'content'],
          before: { exists: true, value: text.content },
          after: { exists: true, value: text.content },
        },
        {
          path: ['nodes', '#invalid'],
          before: { exists: false },
          after: { exists: true, value: {} },
        },
      ],
    }),
  ];
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
  await screen.findByRole('button', { name: 'Original' });
  expect(io.fetch).not.toHaveBeenCalled();
  expect(io.procedure.previewAssets).toEqual([]);
});

it.each(['resolve', 'reject'])(
  'ignores session responses settled by %s after leaving the project',
  async settlement => {
    let finish!: (result: unknown) => void;
    let reject!: (error: Error) => void;
    io.request.mockImplementation(
      () =>
        new Promise((resolve, fail) => {
          finish = resolve;
          reject = fail;
        })
    );
    const view = render(<Harness />);
    view.unmount();
    await act(async () => {
      if (settlement === 'resolve') finish(io.session);
      else reject(new Error('Offline'));
    });
    expect(io.procedure.tools).toBeNull();
  }
);

it('reports an initial session failure and refreshes the recovered project on reconnect', async () => {
  vi.useFakeTimers();
  io.request.mockRejectedValueOnce(new Error('Session unavailable'));
  render(<Harness />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole('alert').textContent).toContain('Session unavailable');
  await act(async () => {
    fireEvent(window, new Event('online'));
    await Promise.resolve();
  });
  expect(screen.getByRole('button', { name: 'Collaborative Editing' })).toBeTruthy();
  cleanup();
  const count = io.request.mock.calls.length;
  await vi.advanceTimersByTimeAsync(8000);
  expect(io.request).toHaveBeenCalledTimes(count);
});

it.each([null, [], {}])(
  'preserves the live procedure when a command refresh returns the incomplete session %s',
  async invalid => {
    io.session.proposals = [proposal({ origin: 'ai' })];
    io.session.groupId = null;
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
    const accept = await screen.findByRole('button', { name: 'Accept' });
    const request = io.request.getMockImplementation()!;
    io.request.mockImplementation((operation, input) =>
      input.action === 'session' ? Promise.resolve(invalid) : request(operation, input)
    );
    fireEvent.click(accept);
    await waitFor(() =>
      command('acceptPrivate', { workspaceId: '00000000-0000-4000-a000-000000000003' })
    );
    await waitFor(() => expect((accept as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole('region', { name: 'Change request' })).toBeTruthy();
  }
);

it.each(['live-error', 'late-error', 'no-base'])(
  'handles proposal draft loading with %s',
  async mode => {
    io.session.proposals = [proposal()];
    const request = io.request.getMockImplementation()!;
    let reject!: (error: Error) => void;
    io.request.mockImplementation((operation, input) =>
      input.action === 'loadDraft'
        ? mode === 'no-base'
          ? Promise.resolve({})
          : new Promise((_resolve, fail) => {
              reject = fail;
            })
        : request(operation, input)
    );
    const view = render(<Harness workspaceId="00000000-0000-4000-a000-000000000003" />);
    await screen.findByRole('button', { name: 'Back to project' });
    if (mode === 'no-base') expect(screen.queryByRole('button', { name: 'Original' })).toBeNull();
    else {
      if (mode === 'late-error') view.unmount();
      await act(async () => reject(new Error('Draft unavailable')));
      if (mode === 'live-error')
        expect(screen.getByRole('alert').textContent).toContain('Draft unavailable');
      else expect(screen.queryByRole('alert')).toBeNull();
    }
  }
);

it.each(['preview', 'ghost'])(
  'does not allocate a late %s media URL after the editor has unmounted',
  async type => {
    let finish!: (value: Blob) => void;
    io.assets = [{ id: 'private', url: '/private', mime: 'image/png' }];
    io.fetch.mockResolvedValue({
      ok: true,
      blob: () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    });
    io.session.proposals = [
      proposal({
        state: 'submitted',
        changes:
          type === 'ghost'
            ? [
                {
                  path: ['nodes', '#private'],
                  before: { exists: false },
                  after: { exists: true, value: { type: 'chart' } },
                },
              ]
            : [],
      }),
    ];
    const view = render(<Harness />);
    if (type === 'preview') fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
    await waitFor(() => expect(io.fetch).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => finish(new Blob(['late media'])));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(io.procedure.previewAssets).toEqual([]);
  }
);

it.each(['preview', 'ghost'])(
  'ignores a rejected %s media request after the editor has unmounted',
  async type => {
    let reject!: (error: Error) => void;
    io.assets = [{ id: 'private', url: '/private', mime: 'image/png' }];
    io.fetch.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        })
    );
    io.session.proposals = [
      proposal({
        state: 'submitted',
        changes:
          type === 'ghost'
            ? [
                {
                  path: ['nodes', '#private'],
                  before: { exists: false },
                  after: { exists: true, value: { type: 'media' } },
                },
              ]
            : [],
      }),
    ];
    const view = render(<Harness />);
    if (type === 'preview') fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
    await waitFor(() => expect(io.fetch).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => reject(new Error('Request aborted')));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  }
);

it('renders the initial procedure without document globals on the server', () => {
  vi.stubGlobal('document', undefined);
  expect(renderToString(<Harness />)).toContain('Open proposal');
  vi.unstubAllGlobals();
});

it('denies anonymous voting and editing, falls back from view mode, and respects the controller busy state', async () => {
  io.user = null;
  io.session.phase = 'vote_internal';
  io.session.proposals = [
    proposal({ owner_id: '00000000-0000-4000-a000-000000000012', state: 'voting', electorate: [] }),
  ];
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
  await screen.findByRole('region', { name: 'Change request' });
  expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Edit draft' })).toBeNull();
  cleanup();
  io.session = { ...io.session, phase: 'view', proposals: [] };
  io.controller = { ...io.controller, canEdit: false, busy: true, status: 'offline' };
  render(<Harness />);
  await screen.findByRole('button', { name: 'Internal Suggestions' });
  expect(
    (screen.getByRole('button', { name: 'Recover as a new proposal' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(io.procedure.editingAllowed).toBe(false);
});

it('reports a rejected decision while preserving the selected proposal for retry', async () => {
  io.session.groupId = null;
  io.session.proposals = [proposal({ origin: 'ai' })];
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
  const accept = await screen.findByRole('button', { name: 'Accept' });
  io.request.mockRejectedValueOnce(new Error('Permission denied'));
  fireEvent.click(accept);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Permission denied'));
  expect((accept as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole('region', { name: 'Change request' })).toBeTruthy();
});

it('navigates to the adopted group only after the server acknowledges the committed revision', async () => {
  const assign = vi.fn();
  vi.stubGlobal('location', { assign });
  io.session.adoptionGroups = [{ id: '00000000-0000-4000-a000-000000000021', name: 'Destination' }];
  render(<Harness />);
  fireEvent.click(await screen.findByText('Move to a group workspace'));
  fireEvent.change(screen.getByRole('combobox', { name: 'Destination group' }), {
    target: { value: '00000000-0000-4000-a000-000000000021' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Share project with this group' }));
  await waitFor(() =>
    command('adopt', { groupId: '00000000-0000-4000-a000-000000000021', revision: 7 })
  );
  await waitFor(() =>
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      '/group/00000000-0000-4000-a000-000000000021/studio/00000000-0000-4000-a000-000000000002'
    )
  );
});

it('opens an old proposal without a base document or canonical nodes and ignores absent changes', async () => {
  io.controller.v3Value = undefined;
  io.session.proposals = [proposal({ state: 'submitted', changes: null })];
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementation((operation, input) =>
    input.action === 'loadDraft'
      ? Promise.resolve({ document: io.proposed })
      : request(operation, input)
  );
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
  await screen.findByRole('button', { name: 'Original' });
  expect(io.procedure.markers).toEqual([]);
  expect(io.procedure.previewDocument.title).toBe('Base');
});

it('reuses canonical assets while hydrating only additional proposal media', async () => {
  const canonical = { id: 'canonical', url: '/canonical', mime: 'image/png' };
  const privateAsset = { id: 'private', url: '/private', mime: 'image/png' };
  io.controller.assets = [canonical, { id: 'unrelated' }];
  io.assets = [canonical, privateAsset];
  io.session.proposals = [proposal({ state: 'submitted', changes: null })];
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Open proposal' }));
  await waitFor(() =>
    expect(io.procedure.previewAssets).toEqual([{ ...privateAsset, url: 'blob:fixture' }])
  );
  expect(io.fetch).toHaveBeenCalledExactlyOnceWith('/private', {
    headers: { Authorization: 'Bearer fixture-token' },
  });
});

it('drops a second suggestion submission while the first command awaits acknowledgement', async () => {
  io.session.phase = 'suggest_internal';
  let finish!: (value: unknown) => void;
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementation((operation, input) =>
    input.action === 'createDraft'
      ? new Promise(resolve => {
          finish = resolve;
        })
      : request(operation, input)
  );
  render(<Harness />);
  const title = await screen.findByRole('textbox', { name: 'Proposal title' });
  fireEvent.change(title, { target: { value: 'New draft' } });
  fireEvent.submit(title.closest('form')!);
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Start proposal' }) as HTMLButtonElement).disabled
    ).toBe(true)
  );
  fireEvent.submit(title.closest('form')!);
  expect(io.request.mock.calls.filter(([, input]) => input.action === 'createDraft')).toHaveLength(
    1
  );
  await act(async () => finish({}));
  expect(
    (screen.getByRole('button', { name: 'Start proposal' }) as HTMLButtonElement).disabled
  ).toBe(false);
});

it.each(['success', 'error', 'unauthorized'])(
  'returns from the private draft through %s while preserving it until acknowledgement',
  async outcome => {
    io.session.phase = 'suggest_internal';
    io.session.proposals = [proposal()];
    let finish!: (revision: number) => void;
    let reject!: (error: Error) => void;
    io.commit.mockImplementation(
      () =>
        new Promise((resolve, fail) => {
          finish = resolve;
          reject = fail;
        })
    );
    render(<Harness workspaceId="00000000-0000-4000-a000-000000000003" />);
    const back = await screen.findByRole('button', { name: 'Back to project' });
    fireEvent.click(back);
    expect((back as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(back);
    expect(io.commit).toHaveBeenCalledTimes(1);
    expect(io.choose).not.toHaveBeenCalled();
    await act(async () => {
      if (outcome === 'success') finish(7);
      else
        reject(new Error(outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'));
    });
    if (outcome === 'success') expect(io.choose).toHaveBeenCalledWith();
    else {
      expect(io.choose).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toContain(
        outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'
      );
    }
    expect((back as HTMLButtonElement).disabled).toBe(false);
  }
);
