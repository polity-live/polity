import { cleanup, render, waitFor } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useStudioProcedure } from '../useStudioProcedure';
import { StudioProcedureTools } from '../StudioProcedureTools';
import { useStudioController } from '../../hooks/useStudioController';
import { createDocument } from '../../logic/templates';
import { legacyDocumentToV3 } from '../../logic/v3-adapter';

const io = vi.hoisted(() => ({
  user: { id: 'actor' } as { id: string } | null,
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
  useUserState: () => ({ currentUser: { id: 'actor' } }),
}));
vi.mock('@/zero/communication-studio/useStudioState', () => ({
  useStudioState: () => ({ projects: [], exports: [], isLoading: false }),
}));
vi.mock('@/zero/communication-studio/useStudioApi', () => ({ useStudioApi: () => io }));
vi.mock('../../hooks/useStudioDocument', () => ({ useStudioDocument: () => io.editor }));
let finish: (result: unknown) => void;
let reject: (error: Error) => void;
const controller = () => ({
  actions: { request: io.request },
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
function Harness() {
  const procedure = useStudioProcedure({
    projectId: 'project',
    chooseWorkspace: io.choose,
    c: controller() as never,
  });
  return (
    <>
      {procedure.tools}
      {procedure.canvasOverlay}
    </>
  );
}
function ControllerHarness() {
  const c = useStudioController('group', 'project', io.choose);
  const procedure = useStudioProcedure({ projectId: 'project', chooseWorkspace: io.choose, c });
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
  io.user = { id: 'actor' };
  io.session = {
    canEditProject: true,
    groupId: 'group',
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
    comments: [
      {
        id: 'comment',
        author_id: 'actor',
        proposal_id: null,
        element_id: null,
        body: 'Existing discussion',
        resolved: false,
      },
    ],
    revisions: [{ id: 'revision', revision: 2, created_at: 0 }],
    members: [],
    roles: [
      { id: 'role', name: 'Editors', capabilities: { suggest: true, comment: true, vote: true } },
    ],
    adoptionGroups: [{ id: 'group', name: 'Destination' }],
  };
  const pending = new Promise((resolve, fail) => {
    finish = resolve;
    reject = fail;
  });
  io.request.mockImplementation(async (operation, input) => {
    if (operation === 'themes' || operation === 'elementSets') return [];
    if (operation === 'load') return { revision: 11 };
    if (input.action === 'session') return io.session;
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
    input: { body: 'Revised discussion', commentId: 'comment' },
  },
  { action: 'resolveComment', label: 'Resolve', input: { commentId: 'comment' } },
  { action: 'restore', label: 'Restore as new revision', input: { historyId: 'revision' } },
  {
    action: 'setCapability',
    label: 'Suggest',
    input: { roleId: 'role', capability: 'suggest', allowed: false },
  },
  {
    action: 'setCapability',
    label: 'Comment',
    input: { roleId: 'role', capability: 'comment', allowed: false },
  },
  {
    action: 'setCapability',
    label: 'Vote',
    input: { roleId: 'role', capability: 'vote', allowed: false },
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
        projectId: 'project',
        generation: 'generation',
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
        expect.objectContaining({ action: 'adopt', groupId: 'group', revision: 7 })
      )
    );
    reject(new Error(outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable'));
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(outcome === 'unauthorized' ? 'Permission denied' : 'Service unavailable');
    await expect.element(select).toHaveValue('group');
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
  await expect.element(select).toHaveValue('group');
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
