/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StudioProcedureComments, StudioProcedureTools } from '../StudioProcedureTools';
import type { CanvasSession } from '../../logic/governance';

const auth = vi.hoisted(() => ({ user: { id: 'actor' } as { id: string } | null }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: auth.user }) }));
const tr = (_de: string, en: string) => en;
let session: CanvasSession;
let c: any;
let run = vi.fn<(action: string, input?: Record<string, unknown>) => Promise<boolean>>();
let choose = vi.fn<(id?: string) => void>();
beforeEach(() => {
  auth.user = { id: 'actor' };
  session = {
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
    comments: [],
    revisions: [],
    members: [],
    roles: [],
    adoptionGroups: [],
  };
  c = {
    status: 'saved',
    selected: [],
    v3Value: { nodes: [{ id: 'existing' }] },
    downloadLocalDraft: vi.fn(),
    recoverAsProposal: vi.fn().mockResolvedValue('recovered'),
    run: vi.fn(async (callback: () => Promise<void>) => callback()),
  };
  run = vi.fn().mockResolvedValue(true);
  choose = vi.fn();
});
afterEach(cleanup);
const comment = (overrides: Record<string, unknown> = {}) => ({
  id: 'comment',
  author_id: 'actor',
  proposal_id: null,
  element_id: null,
  body: 'Original discussion',
  resolved: false,
  ...overrides,
});
function comments(workspaceId?: string, busy = false) {
  return render(
    <StudioProcedureComments
      session={session}
      workspaceId={workspaceId}
      c={c}
      busy={busy}
      run={run}
      tr={tr}
    />
  );
}
function tools(workspaceId?: string, busy = false) {
  return render(
    <StudioProcedureTools
      session={session}
      workspaceId={workspaceId}
      c={c}
      busy={busy}
      run={run}
      chooseWorkspace={choose}
      tr={tr}
    />
  );
}

it.each([true, false])(
  'submits a keyboard comment and clears the text only after success=%s',
  async success => {
    run.mockResolvedValue(success);
    c.selected = ['existing'];
    comments('proposal');
    const user = userEvent.setup();
    const input = screen.getByRole('textbox', { name: 'Comment' });
    await user.click(input);
    await user.keyboard('  New discussion  ');
    await user.tab();
    const button = screen.getByRole('button', { name: 'Comment' });
    expect(document.activeElement).toBe(button);
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(run).toHaveBeenCalledExactlyOnceWith('comment', {
        workspaceId: 'proposal',
        body: 'New discussion',
        elementId: 'existing',
      })
    );
    expect((input as HTMLTextAreaElement).value).toBe(success ? '' : '  New discussion  ');
    expect(document.activeElement).toBe(button);
  }
);

it('rejects blank comment submissions and binds canonical comments to no node when nothing is selected', async () => {
  comments();
  const input = screen.getByRole('textbox', { name: 'Comment' });
  fireEvent.submit(input.closest('form')!);
  expect(run).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: 'Comment' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  fireEvent.change(input, { target: { value: 'Canonical comment' } });
  fireEvent.submit(input.closest('form')!);
  await waitFor(() =>
    expect(run).toHaveBeenCalledExactlyOnceWith('comment', {
      workspaceId: undefined,
      body: 'Canonical comment',
      elementId: null,
    })
  );
});

it.each([true, false])(
  'edits a keyboard comment and keeps the edit open after success=%s',
  async success => {
    session.comments = [comment() as any];
    run.mockResolvedValue(success);
    comments();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const input = screen.getByRole('textbox', { name: 'Edit comment' });
    await user.click(input);
    await user.clear(input);
    await user.keyboard('  Revised discussion  ');
    await user.tab();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(document.activeElement).toBe(save);
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(run).toHaveBeenCalledExactlyOnceWith('editComment', {
        commentId: 'comment',
        body: 'Revised discussion',
      })
    );
    expect(!!screen.queryByRole('textbox', { name: 'Edit comment' })).toBe(!success);
  }
);

it('rejects blank edits and cancels without changing the existing discussion', () => {
  session.comments = [comment() as any];
  comments();
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  const input = screen.getByRole('textbox', { name: 'Edit comment' });
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.submit(input.closest('form')!);
  expect(run).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Original discussion')).toBeTruthy();
  expect(screen.queryByRole('textbox', { name: 'Edit comment' })).toBeNull();
});

it.each(['owner', 'manager', 'other', 'anonymous', 'denied', 'resolved'] as const)(
  'enforces comment edit and resolution rights for %s',
  mode => {
    auth.user = mode === 'anonymous' ? null : { id: 'actor' };
    session.capabilities.comment = mode !== 'denied';
    session.capabilities.manage = mode === 'manager';
    session.comments = [
      comment({
        author_id: mode === 'owner' || mode === 'denied' || mode === 'resolved' ? 'actor' : 'other',
        resolved: mode === 'resolved',
      }) as any,
    ];
    comments();
    expect(!!screen.queryByRole('button', { name: 'Edit' })).toBe(
      mode === 'owner' || mode === 'resolved'
    );
    const resolve = screen.queryByRole('button', { name: 'Resolve' });
    expect(!!resolve).toBe(mode === 'owner' || mode === 'manager');
    if (resolve) {
      fireEvent.click(resolve);
      expect(run).toHaveBeenCalledWith('resolveComment', { commentId: 'comment' });
    }
    if (mode === 'resolved') expect(screen.getByText('Resolved')).toBeTruthy();
  }
);

it.each(['existing', 'deleted', 'absent-document', 'unbound'] as const)(
  'marks only missing node targets as orphaned (%s)',
  mode => {
    if (mode === 'absent-document') c.v3Value = undefined;
    session.comments = [
      comment({
        element_id: mode === 'unbound' ? null : mode === 'existing' ? 'existing' : 'deleted',
      }) as any,
      comment({ id: 'private', proposal_id: 'private', body: 'Hidden proposal discussion' }) as any,
    ];
    comments();
    expect(!!screen.queryByText('Target no longer exists')).toBe(
      mode === 'deleted' || mode === 'absent-document'
    );
    expect(screen.queryByText('Hidden proposal discussion')).toBeNull();
  }
);

it('keeps discussion controls disabled while saving and does not submit a duplicate', async () => {
  session.comments = [comment() as any];
  const view = comments();
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), {
    target: { value: 'Pending' },
  });
  view.rerender(<StudioProcedureComments session={session} c={c} busy run={run} tr={tr} />);
  for (const name of ['Save', 'Edit', 'Resolve', 'Comment'])
    expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));
  expect(run).not.toHaveBeenCalled();
});

it.each(['conflict', 'offline', 'unavailable', 'error'])(
  'recovers the %s draft without replacing the canonical workspace',
  async status => {
    c.status = status;
    c.recovery = { title: 'Local draft' };
    tools();
    expect(screen.getByText(/Local draft/)).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Download draft' }));
    expect(c.downloadLocalDraft).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Recover as a new proposal' }));
    await waitFor(() => expect(choose).toHaveBeenCalledExactlyOnceWith('recovered'));
    expect(c.run).toHaveBeenCalledTimes(1);
  }
);

it('shows recovery with no stored fields and denies proposal recovery without suggestion rights', () => {
  c.status = 'offline';
  session.capabilities.suggest = false;
  tools();
  expect(screen.getByRole('button', { name: 'Download draft' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Recover as a new proposal' })).toBeNull();
});

it('restores a revision, adopts the selected group and toggles every role capability in both directions', async () => {
  session.revisions = [{ id: 'revision', revision: 2, created_at: 0 }];
  session.adoptionGroups = [{ id: 'destination', name: 'Destination' }];
  session.roles = [{ id: 'role', name: 'Editors', capabilities: {} }];
  tools();
  const user = userEvent.setup();
  await user.click(screen.getByText('Revision history'));
  await user.click(screen.getByRole('button', { name: 'Restore as new revision' }));
  expect(run).toHaveBeenCalledWith('restore', { historyId: 'revision' });
  await user.click(screen.getByText('Move to a group workspace'));
  const adopt = screen.getByRole('button', { name: 'Share project with this group' });
  expect((adopt as HTMLButtonElement).disabled).toBe(true);
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Destination group' }),
    'destination'
  );
  await user.click(adopt);
  expect(run).toHaveBeenCalledWith('adopt', { groupId: 'destination' });
  await user.click(screen.getByText('Group roles in canvas procedures'));
  for (const [label, capability] of [
    ['Suggest', 'suggest'],
    ['Comment', 'comment'],
    ['Vote', 'vote'],
  ]) {
    const checkbox = screen.getByRole('checkbox', { name: label });
    await user.click(checkbox);
    expect(run).toHaveBeenCalledWith('setCapability', {
      roleId: 'role',
      capability,
      allowed: false,
    });
  }
  cleanup();
  session.roles[0].capabilities = { suggest: false, comment: false, vote: false };
  session.roles[0].name = null;
  tools();
  await user.click(screen.getByText('Group roles in canvas procedures'));
  expect(screen.getByText('role')).toBeTruthy();
  for (const [label, capability] of [
    ['Suggest', 'suggest'],
    ['Comment', 'comment'],
    ['Vote', 'vote'],
  ]) {
    await user.click(screen.getByRole('checkbox', { name: label }));
    expect(run).toHaveBeenCalledWith('setCapability', {
      roleId: 'role',
      capability,
      allowed: true,
    });
  }
});

it.each(['busy', 'phase', 'workspace', 'unauthorized', 'no-groups'] as const)(
  'gates history, adoption and role controls for %s',
  mode => {
    session.revisions = [{ id: 'revision', revision: 2, created_at: 0 }];
    session.adoptionGroups =
      mode === 'no-groups' ? (undefined as any) : [{ id: 'destination', name: 'Destination' }];
    session.roles = [{ id: 'role', name: 'Editors', capabilities: {} }];
    if (mode === 'phase') session.phase = 'view';
    if (mode === 'unauthorized') session.capabilities.manage = false;
    tools(mode === 'workspace' ? 'draft' : undefined, mode === 'busy');
    const restore = screen.queryByRole('button', { name: 'Restore as new revision', hidden: true });
    expect(!!restore).toBe(mode !== 'workspace' && mode !== 'unauthorized');
    if (restore)
      expect((restore as HTMLButtonElement).disabled).toBe(mode === 'busy' || mode === 'phase');
    const adopt = screen.queryByRole('button', {
      name: 'Share project with this group',
      hidden: true,
    });
    expect(!!adopt).toBe(mode !== 'workspace' && mode !== 'no-groups');
    if (adopt) {
      fireEvent.change(screen.getByRole('combobox', { name: 'Destination group', hidden: true }), {
        target: { value: 'destination' },
      });
      expect((adopt as HTMLButtonElement).disabled).toBe(mode === 'busy' || mode === 'phase');
    }
    const checkbox = screen.queryByRole('checkbox', { name: 'Suggest', hidden: true });
    expect(!!checkbox).toBe(mode !== 'unauthorized');
    if (checkbox && mode === 'busy')
      expect((checkbox.closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    expect(!!screen.queryByRole('textbox', { name: 'Comment' })).toBe(mode !== 'workspace');
    expect(run).not.toHaveBeenCalled();
  }
);
