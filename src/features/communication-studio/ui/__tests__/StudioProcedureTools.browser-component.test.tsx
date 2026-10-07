import { studioClientFixture } from '@/test/studio-client.fixture';
import { cleanup, render, waitFor } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useStudioProcedure } from '../useStudioProcedure';
import { StudioProcedureTools } from '../StudioProcedureTools';
import { useStudioController } from '../../hooks/useStudioController';
import { createDocument } from '../../logic/templates';
import { legacyDocumentToV3 } from '../../logic/v3-adapter';
import { Toolbar } from '@/features/shared/ui/layout';

const io = vi.hoisted(() => ({
  user: { id: '00000000-0000-4000-a000-000000000008' } as { id: string } | null,
  session: null as any,
  request: vi.fn(),
  commit: vi.fn(),
  run: vi.fn(),
  download: vi.fn(),
  recover: vi.fn(),
  choose: vi.fn(),
  notifyError: vi.fn(),
  editor: {} as any,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: io.user }) }));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: vi.fn() }) }));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: { id: '00000000-0000-4000-a000-000000000008' } }),
}));
vi.mock('@/zero/communication-studio/useStudioState', () => ({
  useStudioState: () => ({ projects: [], exports: [], isLoading: false }),
}));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return { useStudioClient: () => studioClientFixture(io) };
});
vi.mock('../../hooks/useStudioDocument', () => ({ useStudioDocument: () => io.editor }));
let finish: (result: unknown) => void;
let reject: (error: Error) => void;
const controller = () => ({
  actions: studioClientFixture(io),
  commit: io.commit,
  selected: ['node'],
  canEdit: true,
  assets: [],
  v3Value: { nodes: [{ id: 'node' }] },
  status: 'saved',
  downloadLocalDraft: io.download,
  recoverAsProposal: io.recover,
  run: io.run,
});
function Harness({ workspaceId }: { workspaceId?: string }) {
  const procedure = useStudioProcedure({
    projectId: '00000000-0000-4000-a000-000000000002',
    workspaceId,
    chooseWorkspace: io.choose,
    c: controller() as never,
  });
  return (
    <main style={{ position: 'relative', minHeight: 800 }}>
      <Toolbar>{procedure.modeButton}</Toolbar>
      {procedure.tools}
      {procedure.canvasOverlay}
    </main>
  );
}
function ControllerHarness() {
  const c = useStudioController(
    '00000000-0000-4000-a000-000000000004',
    '00000000-0000-4000-a000-000000000002',
    io.choose
  );
  const procedure = useStudioProcedure({
    projectId: '00000000-0000-4000-a000-000000000002',
    chooseWorkspace: io.choose,
    c,
  });
  return (
    <>
      {procedure.tools}
      {procedure.canvasOverlay}
      {c.failure && <p role="alert">{c.failure}</p>}
    </>
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  await page.viewport(1280, 800);
  document.documentElement.lang = 'en';
  io.user = { id: '00000000-0000-4000-a000-000000000008' };
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
    comments: [
      {
        id: '00000000-0000-4000-a000-000000000006',
        author_id: '00000000-0000-4000-a000-000000000008',
        proposal_id: null,
        element_id: null,
        body: 'Existing discussion',
        resolved: false,
      },
    ],
    revisions: [{ id: '00000000-0000-4000-a000-000000000009', revision: 2, created_at: 0 }],
    members: [],
    roles: [
      {
        id: '00000000-0000-4000-a000-000000000007',
        name: 'Editors',
        capabilities: { suggest: true, comment: true, vote: true },
      },
    ],
    adoptionGroups: [{ id: '00000000-0000-4000-a000-000000000004', name: 'Destination' }],
  };
  const pending = new Promise((resolve, fail) => {
    finish = resolve;
    reject = fail;
  });
  io.request.mockImplementation(async (operation, input) => {
    if (operation === 'themes' || operation === 'elementSets') return [];
    if (operation === 'assets') return [];
    if (operation === 'load') return { revision: 11 };
    if (input.action === 'session') return io.session;
    if (input.action === 'loadDraft')
      return { document: { nodes: [] }, baseDocument: { nodes: [] } };
    const result = await pending;
    if (input.action === 'setCapability')
      io.session = {
        ...io.session,
        roles: [
          {
            ...io.session.roles[0],
            capabilities: {
              ...io.session.roles[0].capabilities,
              [input.capability]: input.allowed,
            },
          },
        ],
      };
    if (input.action === 'resolveComment')
      io.session = {
        ...io.session,
        comments: [{ ...io.session.comments[0], resolved: true }],
      };
    if (input.action === 'share')
      io.session = {
        ...io.session,
        proposals: io.session.proposals.map((item: any) =>
          item.id === input.workspaceId ? { ...item, shared_ids: input.userIds } : item
        ),
      };
    if (input.action === 'vote')
      io.session = {
        ...io.session,
        proposals: io.session.proposals.map((item: any) =>
          item.id === input.workspaceId
            ? {
                ...item,
                votes: [{ user_id: '00000000-0000-4000-a000-000000000008', choice: input.choice }],
              }
            : item
        ),
      };
    if (input.action === 'phase') io.session = { ...io.session, phase: input.phase };
    return result;
  });
  io.commit.mockResolvedValue(7);
  io.recover.mockResolvedValue('recovered');
  io.run.mockImplementation(async callback => callback());
  const value = createDocument('single', 'Recovery fixture');
  io.editor = {
    value,
    v3Value: legacyDocumentToV3(value),
    assets: [],
    peers: [],
    canEdit: true,
    status: 'offline',
    error: '',
    commit: io.commit,
    recoverAsProposal: io.recover,
    downloadLocalDraft: io.download,
  };
});
afterEach(cleanup);

const operations = [
  { action: 'comment', label: 'Comment', input: { body: 'New discussion', elementId: 'node' } },
  {
    action: 'editComment',
    label: 'Save',
    input: { body: 'Revised discussion', commentId: '00000000-0000-4000-a000-000000000006' },
  },
  {
    action: 'resolveComment',
    label: 'Resolve',
    input: { commentId: '00000000-0000-4000-a000-000000000006' },
  },
  {
    action: 'restore',
    label: 'Restore as new revision',
    input: { historyId: '00000000-0000-4000-a000-000000000009' },
  },
  {
    action: 'setCapability',
    label: 'Suggest',
    input: {
      roleId: '00000000-0000-4000-a000-000000000007',
      capability: 'suggest',
      allowed: false,
    },
  },
  {
    action: 'setCapability',
    label: 'Comment',
    input: {
      roleId: '00000000-0000-4000-a000-000000000007',
      capability: 'comment',
      allowed: false,
    },
  },
  {
    action: 'setCapability',
    label: 'Vote',
    input: { roleId: '00000000-0000-4000-a000-000000000007', capability: 'vote', allowed: false },
  },
];
it.each(
  operations.flatMap(operation =>
    ['success', 'error', 'unauthorized'].map(outcome => ({ ...operation, outcome }))
  )
)(
  'executes $action with native keyboard input through $outcome and blocks duplicate commands while pending',
  async operation => {
    render(<Harness />);
    await expect.element(page.getByRole('textbox', { name: 'Comment', exact: true })).toBeVisible();
    if (operation.action === 'comment') {
      const input = page.getByRole('textbox', { name: 'Comment', exact: true });
      await input.click();
      await userEvent.keyboard('New discussion');
      await expect.element(input).toHaveFocus();
    }
    if (operation.action === 'editComment') {
      const edit = page.getByRole('button', { name: 'Edit', exact: true });
      await edit.click();
      const input = page.getByRole('textbox', { name: 'Edit comment', exact: true });
      await input.click();
      await userEvent.keyboard('{Control>}a{/Control}Revised discussion');
      await expect.element(input).toHaveFocus();
    }
    if (operation.action === 'restore')
      await page.getByText('Revision history', { exact: true }).click();
    if (operation.action === 'setCapability')
      await page.getByText('Group roles in canvas procedures', { exact: true }).click();
    const control = page.getByRole(operation.action === 'setCapability' ? 'checkbox' : 'button', {
      name: operation.label,
      exact: true,
    });
    await control.element().focus();
    await expect.element(control).toHaveFocus();
    await userEvent.keyboard(operation.action === 'setCapability' ? ' ' : '{Enter}');
    await expect.element(control).toBeDisabled();
    await userEvent.keyboard('{Enter} ');
    await waitFor(() =>
      expect(
        io.request.mock.calls.filter(([, input]) => input.action === operation.action)
      ).toHaveLength(1)
    );
    expect(io.request).toHaveBeenCalledWith(
      'canvas',
      expect.objectContaining({
        projectId: '00000000-0000-4000-a000-000000000002',
        generation: '00000000-0000-4000-a000-000000000001',
        operationId: expect.any(String),
        ...operation.input,
      })
    );
    if (operation.action === 'restore')
      expect(io.request).toHaveBeenCalledWith('canvas', expect.objectContaining({ revision: 11 }));
    if (operation.outcome === 'success') {
      finish({});
      if (operation.action === 'comment')
        await expect
          .element(page.getByRole('textbox', { name: 'Comment', exact: true }))
          .toHaveValue('');
      if (operation.action === 'editComment')
        await expect
          .element(page.getByRole('textbox', { name: 'Edit comment' }))
          .not.toBeInTheDocument();
      if (operation.action === 'resolveComment')
        await expect.element(page.getByText('Resolved', { exact: true })).toBeVisible();
      if (operation.action === 'setCapability') {
        await expect.element(control).not.toBeChecked();
        control.element().focus();
        await userEvent.keyboard(' ');
        await expect.element(control).toBeChecked();
        expect(io.request).toHaveBeenCalledWith(
          'canvas',
          expect.objectContaining({ allowed: true })
        );
      }
      if (operation.action === 'restore')
        await waitFor(() => expect(io.choose).toHaveBeenCalledWith());
    } else {
      reject(
        new Error(
          operation.outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'
        )
      );
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          `Error: ${operation.outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'}`
        );
      await expect.element(control).not.toBeDisabled();
      if (operation.action === 'comment')
        await expect
          .element(page.getByRole('textbox', { name: 'Comment', exact: true }))
          .toHaveValue('New discussion');
      if (operation.action === 'editComment')
        await expect
          .element(page.getByRole('textbox', { name: 'Edit comment' }))
          .toHaveValue('Revised discussion');
    }
  }
);

it.each(['success', 'error', 'unauthorized'])(
  'recovers a local draft through the real controller with %s and disables all duplicate recovery controls',
  async outcome => {
    io.recover.mockImplementation(
      () =>
        new Promise((resolve, fail) => {
          finish = resolve;
          reject = fail;
        })
    );
    render(<ControllerHarness />);
    const recover = page.getByRole('button', { name: 'Recover as a new proposal' });
    await expect.element(recover).toBeVisible();
    recover.element().focus();
    await expect.element(recover).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect.element(recover).toBeDisabled();
    await userEvent.keyboard('{Enter} ');
    expect(io.recover).toHaveBeenCalledTimes(1);
    if (outcome === 'success') {
      finish('recovered');
      await waitFor(() => expect(io.choose).toHaveBeenCalledExactlyOnceWith('recovered'));
    } else {
      const error = new Error(
        outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'
      );
      reject(error);
      await expect.element(page.getByRole('alert')).toHaveTextContent(error.message);
      expect(io.notifyError).toHaveBeenCalledWith(error);
      expect(io.choose).not.toHaveBeenCalled();
    }
    await expect.element(recover).not.toBeDisabled();
  }
);

it('downloads the retained draft with the native keyboard and keeps the recovery control focused', async () => {
  render(<ControllerHarness />);
  const download = page.getByRole('button', { name: 'Download draft' });
  await expect.element(download).toBeVisible();
  download.element().focus();
  await userEvent.keyboard('{Enter}');
  expect(io.download).toHaveBeenCalledTimes(1);
  await expect.element(download).toHaveFocus();
});

it.each(['error', 'unauthorized'])(
  'preserves the selected adoption group after a rejected native keyboard command (%s)',
  async outcome => {
    render(<Harness />);
    await expect
      .element(page.getByText('Move to a group workspace', { exact: true }))
      .toBeVisible();
    await page.getByText('Move to a group workspace', { exact: true }).click();
    const select = page.getByRole('combobox', { name: 'Destination group' });
    select.element().focus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    const adopt = page.getByRole('button', { name: 'Share project with this group' });
    adopt.element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(adopt).toBeDisabled();
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith(
        'canvas',
        expect.objectContaining({
          action: 'adopt',
          groupId: '00000000-0000-4000-a000-000000000004',
          revision: 7,
        })
      )
    );
    reject(new Error(outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'));
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable');
    await expect.element(select).toHaveValue('00000000-0000-4000-a000-000000000004');
    await expect.element(adopt).not.toBeDisabled();
  }
);

it('chooses and clears a destination with native arrow keys and preserves select focus', async () => {
  render(
    <StudioProcedureTools
      session={io.session}
      c={controller() as never}
      busy={false}
      run={io.run}
      chooseWorkspace={io.choose}
      tr={(_de, en) => en}
    />
  );
  await page.getByText('Move to a group workspace', { exact: true }).click();
  const select = page.getByRole('combobox', { name: 'Destination group' });
  const adopt = page.getByRole('button', { name: 'Share project with this group' });
  await expect.element(adopt).toBeDisabled();
  select.element().focus();
  await userEvent.keyboard('{ArrowDown}{Enter}');
  await expect.element(select).toHaveValue('00000000-0000-4000-a000-000000000004');
  await expect.element(select).toHaveFocus();
  await expect.element(adopt).not.toBeDisabled();
  await userEvent.keyboard('{ArrowUp}{Enter}');
  await expect.element(select).toHaveValue('');
  await expect.element(adopt).toBeDisabled();
});

it('opens and cancels comment editing with the native keyboard without submitting a command', async () => {
  render(<Harness />);
  const edit = page.getByRole('button', { name: 'Edit', exact: true });
  await expect.element(edit).toBeVisible();
  edit.element().focus();
  await userEvent.keyboard('{Enter}');
  const input = page.getByRole('textbox', { name: 'Edit comment' });
  await input.click();
  await userEvent.keyboard('{Control>}a{/Control}Unsubmitted');
  const cancel = page.getByRole('button', { name: 'Cancel' });
  cancel.element().focus();
  await expect.element(cancel).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect.element(input).not.toBeInTheDocument();
  await expect.element(page.getByText('Existing discussion', { exact: true })).toBeVisible();
  expect(io.request.mock.calls.filter(([, input]) => input.action !== 'session')).toHaveLength(0);
});

it('hides protected controls and keeps comment submission disabled without project capabilities', async () => {
  io.user = null;
  io.session.capabilities = {
    ...io.session.capabilities,
    manage: false,
    comment: false,
    suggest: false,
  };
  io.session.adoptionGroups = [];
  render(<Harness />);
  await expect.element(page.getByRole('textbox', { name: 'Comment', exact: true })).toBeVisible();
  for (const name of [
    'Edit',
    'Resolve',
    'Restore as new revision',
    'Share project with this group',
  ])
    await expect.element(page.getByRole('button', { name, exact: true })).not.toBeInTheDocument();
  await page.getByRole('textbox', { name: 'Comment', exact: true }).click();
  await userEvent.keyboard('Unauthorized discussion');
  await expect.element(page.getByRole('button', { name: 'Comment', exact: true })).toBeDisabled();
  expect(io.request.mock.calls.filter(([, input]) => input.action !== 'session')).toHaveLength(0);
});

const proposal = (overrides: Record<string, unknown> = {}) => ({
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
});
const workflow = [
  {
    action: 'createDraft',
    label: 'Start proposal',
    phase: 'suggest_internal',
    workspaceId: undefined,
  },
  {
    action: 'submit',
    label: 'Submit',
    phase: 'suggest_internal',
    workspaceId: '00000000-0000-4000-a000-000000000003',
  },
  { action: 'withdraw', label: 'Withdraw', phase: 'edit', workspaceId: undefined },
  { action: 'acceptPrivate', label: 'Accept', phase: 'edit', workspaceId: undefined },
  { action: 'rejectPrivate', label: 'Reject', phase: 'edit', workspaceId: undefined },
  { action: 'finalize', label: 'Finalize', phase: 'vote_internal', workspaceId: undefined },
  { action: 'reapply', label: 'Retry decision', phase: 'vote_internal', workspaceId: undefined },
  {
    action: 'resolveDraft',
    label: 'Resolution proposal',
    phase: 'vote_internal',
    workspaceId: undefined,
  },
  {
    action: 'return',
    label: 'Back to project',
    phase: 'suggest_internal',
    workspaceId: '00000000-0000-4000-a000-000000000003',
  },
];
it.each(
  workflow.flatMap(operation =>
    ['success', 'error', 'unauthorized'].map(outcome => ({ ...operation, outcome }))
  )
)(
  'runs the proposal $action command through $outcome using native keyboard input and preserves the draft while pending',
  async operation => {
    io.session.phase = operation.phase;
    io.session.comments = [];
    io.session.proposals =
      operation.action === 'createDraft'
        ? []
        : [
            proposal({
              origin: ['acceptPrivate', 'rejectPrivate'].includes(operation.action)
                ? 'ai'
                : undefined,
              state: operation.phase === 'vote_internal' ? 'voting' : 'draft',
              application: ['reapply', 'resolveDraft'].includes(operation.action)
                ? 'conflict'
                : 'pending',
              electorate:
                operation.phase === 'vote_internal'
                  ? ['00000000-0000-4000-a000-000000000008']
                  : null,
            }),
          ];
    if (['acceptPrivate', 'rejectPrivate'].includes(operation.action)) io.session.groupId = null;
    if (operation.action === 'return')
      io.commit.mockImplementation(
        () =>
          new Promise((resolve, fail) => {
            finish = resolve;
            reject = fail;
          })
      );
    render(<Harness workspaceId={operation.workspaceId} />);
    if (operation.action === 'createDraft') {
      const title = page.getByRole('textbox', { name: 'Proposal title' });
      await expect.element(title).toBeVisible();
      await title.click();
      await userEvent.keyboard('New proposal');
      await expect.element(title).toHaveFocus();
      const reason = page.getByRole('textbox', { name: 'Reason' });
      await reason.click();
      await userEvent.keyboard('Specific explanation');
      await expect.element(reason).toHaveFocus();
    } else if (!operation.workspaceId) {
      const row = page.getByRole('button', { name: /^Proposed introduction/ });
      await expect.element(row).toBeVisible();
      row.element().focus();
      await userEvent.keyboard('{Enter}');
    }
    const control = page.getByRole('button', { name: operation.label, exact: true });
    await expect.element(control).toBeVisible();
    control.element().focus();
    await expect.element(control).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect.element(control).toBeDisabled();
    await userEvent.keyboard('{Enter} ');
    if (operation.action === 'return') expect(io.commit).toHaveBeenCalledTimes(1);
    else {
      await waitFor(() =>
        expect(
          io.request.mock.calls.filter(([, input]) => input.action === operation.action)
        ).toHaveLength(1)
      );
      expect(io.request).toHaveBeenCalledWith(
        'canvas',
        expect.objectContaining({
          action: operation.action,
          projectId: '00000000-0000-4000-a000-000000000002',
          generation: '00000000-0000-4000-a000-000000000001',
          operationId: expect.any(String),
          ...(operation.action === 'createDraft'
            ? { title: 'New proposal', reason: 'Specific explanation', revision: 7 }
            : { workspaceId: '00000000-0000-4000-a000-000000000003' }),
        })
      );
    }
    if (operation.outcome === 'success') {
      finish(operation.action === 'return' ? 7 : { workspaceId: 'created' });
      if (['createDraft', 'resolveDraft'].includes(operation.action))
        await waitFor(() => expect(io.choose).toHaveBeenCalledWith('created'));
      else if (['submit', 'return'].includes(operation.action))
        await waitFor(() => expect(io.choose).toHaveBeenCalledWith());
      else if (operation.action === 'withdraw')
        await expect
          .element(page.getByRole('region', { name: 'Change request' }))
          .not.toBeInTheDocument();
      else await expect.element(control).not.toBeDisabled();
    } else {
      reject(
        new Error(
          operation.outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'
        )
      );
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          operation.outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'
        );
      await expect.element(control).not.toBeDisabled();
      if (operation.action === 'createDraft')
        await expect
          .element(page.getByRole('textbox', { name: 'Proposal title' }))
          .toHaveValue('New proposal');
      else await expect.element(page.getByRole('region', { name: 'Change request' })).toBeVisible();
    }
  }
);

it('selects proposal rows, switches every comparison view and closes details with native keyboard input', async () => {
  io.session.proposals = [proposal()];
  render(<Harness />);
  const row = page.getByRole('button', { name: /^Proposed introduction/ });
  await expect.element(row).toHaveAttribute('aria-pressed', 'false');
  row.element().focus();
  await userEvent.keyboard('{Enter}');
  await expect.element(row).toHaveAttribute('aria-pressed', 'true');
  const region = page.getByRole('region', { name: 'Change request' });
  for (const name of ['Original', 'Proposal', 'Difference']) {
    const control = region.getByRole('button', { name, exact: true });
    await expect.element(control).toBeVisible();
    control.element().focus();
    await expect.element(control).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect.element(control).toHaveAttribute('aria-pressed', 'true');
    for (const other of ['Original', 'Proposal', 'Difference'].filter(label => label !== name))
      await expect
        .element(region.getByRole('button', { name: other, exact: true }))
        .toHaveAttribute('aria-pressed', 'false');
  }
  const edit = region.getByRole('button', { name: 'Edit draft' });
  edit.element().focus();
  await expect.element(edit).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(io.choose).toHaveBeenCalledWith('00000000-0000-4000-a000-000000000003');
  const close = region.getByRole('button', { name: 'Close', exact: true });
  close.element().focus();
  await expect.element(close).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect.element(region).not.toBeInTheDocument();
  await expect.element(row).toHaveAttribute('aria-pressed', 'false');
});

it.each(['success', 'error', 'unauthorized'])(
  'shares and revokes access with native keyboard input through %s without losing the selected collaborators',
  async outcome => {
    io.session.phase = 'suggest_internal';
    io.session.proposals = [proposal()];
    io.session.members = [{ id: '00000000-0000-4000-a000-000000000020', first_name: 'Reader' }];
    render(<Harness workspaceId="00000000-0000-4000-a000-000000000003" />);
    const checkbox = page.getByRole('checkbox', { name: 'Reader' });
    await expect.element(checkbox).not.toBeChecked();
    checkbox.element().focus();
    await expect.element(checkbox).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect.element(checkbox).toBeDisabled();
    await userEvent.keyboard(' ');
    await waitFor(() =>
      expect(io.request.mock.calls.filter(([, input]) => input.action === 'share')).toHaveLength(1)
    );
    expect(io.request).toHaveBeenCalledWith(
      'canvas',
      expect.objectContaining({
        action: 'share',
        workspaceId: '00000000-0000-4000-a000-000000000003',
        userIds: ['00000000-0000-4000-a000-000000000020'],
        generation: '00000000-0000-4000-a000-000000000001',
        operationId: expect.any(String),
      })
    );
    if (outcome === 'success') {
      finish({});
      await expect.element(checkbox).toBeChecked();
      await expect.element(checkbox).not.toBeDisabled();
      checkbox.element().focus();
      await expect.element(checkbox).toHaveFocus();
      await userEvent.keyboard(' ');
      await expect.element(checkbox).not.toBeChecked();
      expect(io.request).toHaveBeenCalledWith(
        'canvas',
        expect.objectContaining({ action: 'share', userIds: [] })
      );
    } else {
      reject(new Error(outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'));
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'
        );
      await expect.element(checkbox).not.toBeChecked();
      await expect.element(checkbox).not.toBeDisabled();
    }
  }
);

it.each(
  ['accept', 'reject', 'abstain'].flatMap(choice =>
    ['success', 'error', 'unauthorized'].map(outcome => ({ choice, outcome }))
  )
)(
  'casts the $choice vote through $outcome using native keyboard input and retains the previous vote on failure',
  async ({ choice, outcome }) => {
    io.session.phase = 'vote_internal';
    io.session.comments = [];
    const previous = choice === 'accept' ? 'reject' : 'accept';
    io.session.proposals = [
      proposal({
        state: 'voting',
        electorate: ['00000000-0000-4000-a000-000000000008'],
        votes: [{ user_id: '00000000-0000-4000-a000-000000000008', choice: previous }],
      }),
    ];
    render(<Harness />);
    const row = page.getByRole('button', { name: /^Proposed introduction/ });
    await expect.element(row).toBeVisible();
    row.element().focus();
    await userEvent.keyboard('{Enter}');
    const labels = { accept: 'Yes', reject: 'No', abstain: 'Abstain' };
    const control = page.getByRole('button', {
      name: labels[choice as keyof typeof labels],
      exact: true,
    });
    await expect.element(control).toHaveAttribute('aria-pressed', 'false');
    control.element().focus();
    await expect.element(control).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect.element(control).toBeDisabled();
    await userEvent.keyboard('{Enter} ');
    await waitFor(() =>
      expect(io.request.mock.calls.filter(([, input]) => input.action === 'vote')).toHaveLength(1)
    );
    expect(io.request).toHaveBeenCalledWith(
      'canvas',
      expect.objectContaining({
        action: 'vote',
        workspaceId: '00000000-0000-4000-a000-000000000003',
        choice,
        projectId: '00000000-0000-4000-a000-000000000002',
        generation: '00000000-0000-4000-a000-000000000001',
        operationId: expect.any(String),
      })
    );
    if (outcome === 'success') {
      finish({});
      await expect.element(control).toHaveAttribute('aria-pressed', 'true');
      await expect
        .element(page.getByRole('button', { name: labels[previous], exact: true }))
        .toHaveAttribute('aria-pressed', 'false');
    } else {
      reject(new Error(outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'));
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'
        );
      await expect.element(control).toHaveAttribute('aria-pressed', 'false');
      await expect
        .element(page.getByRole('button', { name: labels[previous], exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    }
    await expect.element(control).not.toBeDisabled();
  }
);

it.each(['success', 'error', 'unauthorized'])(
  'opens and changes the procedure mode through %s with native menu keyboard navigation and restores trigger focus',
  async outcome => {
    render(<Harness />);
    const trigger = page.getByRole('button', { name: 'Collaborative Editing', exact: true });
    await expect.element(trigger).toBeVisible();
    trigger.element().focus();
    await expect.element(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const option = page.getByRole('menuitemradio', { name: /Internal Suggestions/ });
    await expect.element(option).toBeVisible();
    option.element().focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith(
        'canvas',
        expect.objectContaining({ action: 'phase', phase: 'suggest_internal', revision: 11 })
      )
    );
    await expect.element(trigger).toHaveFocus();
    if (outcome === 'success') {
      finish({});
      await expect
        .element(page.getByRole('button', { name: 'Internal Suggestions', exact: true }))
        .toBeVisible();
    } else {
      reject(new Error(outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'));
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'
        );
      await expect.element(trigger).toBeVisible();
    }
  }
);
