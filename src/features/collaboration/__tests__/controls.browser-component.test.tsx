import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent, page } from 'vitest/browser';
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
import type { CollaborationClient } from '../hooks/useCollaborationDocument';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function client(): CollaborationClient {
  return {
    phase: 'active',
    status: 'saved',
    canEdit: true,
    error: null,
    session: {
      id: 'doc',
      generation: 'g',
      revision: 1,
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
    value: [{ type: 'p', children: [{ text: 'Server' }] }],
    recoveries: [],
    workspaces: [],
    commit: vi.fn().mockResolvedValue({ id: 'doc', generation: 'g', revision: 2 }),
    reload: vi.fn(),
    createDraft: vi.fn().mockResolvedValue(undefined),
    submit: vi.fn().mockResolvedValue(undefined),
    share: vi.fn().mockResolvedValue(undefined),
    selectWorkspace: vi.fn(),
    exportRecovery: vi.fn(),
    inspectRecovery: vi.fn().mockResolvedValue({ base: 'Original', local: 'Offline' }),
  } as unknown as CollaborationClient;
}
async function activate(name: string) {
  const button = page.getByRole('button', { name, exact: true });
  const element = button.element() as HTMLButtonElement;
  element.focus();
  expect(document.activeElement).toBe(element);
  await userEvent.keyboard('{Enter}');
}
it('operates collaboration draft, sharing, repair and offline controls with the keyboard', async () => {
  const c = client();
  const ui = render(<CollaborationStatus client={c} />);
  await activate('Create a separate draft');
  expect(c.createDraft).toHaveBeenCalledWith('followup');
  c.session!.reference.workspaceId = 'draft';
  c.workspaces = [{ id: 'draft', owner: true, shared: false, frozen: false, type: 'proposal' }];
  ui.rerender(<CollaborationStatus client={c} />);
  await activate('Share with eligible collaborators');
  await activate('Submit proposal');
  expect(c.share).toHaveBeenCalledWith(true);
  expect(c.submit).toHaveBeenCalledOnce();
  const select = page.getByRole('combobox', { name: 'Workspace' }).element() as HTMLSelectElement;
  select.focus();
  await userEvent.keyboard('{ArrowUp}');
  expect(c.selectWorkspace).toHaveBeenCalledWith(null);
  c.error = 'Access changed';
  c.status = 'offline';
  c.recoveries = ['old'];
  c.session!.integrityError = 'checksum';
  c.session!.readableRevision = 1;
  api.mockResolvedValue({});
  ui.rerender(<CollaborationStatus client={c} />);
  await activate('Reconnect; keep local draft');
  await activate('Download earlier local draft 1');
  expect(c.exportRecovery).toHaveBeenCalledWith('old');
  await activate('Geprüfte Fassung wiederherstellen');
  expect(api).toHaveBeenCalledWith('repair', expect.objectContaining({ expectedRevision: 1 }));
});
it('compares and resumes offline work and loads, restores and rebases revisions using native activation', async () => {
  const c = client();
  c.recoveries = ['old'];
  api.mockImplementation(async (op: string) =>
    op === 'revisions'
      ? [{ id: 'old', revision: 1, reason: 'edit', projection: 'History' }]
      : op === 'resume'
        ? { workspaceId: 'new' }
        : { revision: 2 }
  );
  const ui = render(<CollaborationStatus client={c} />);
  await activate('Lokalen Entwurf 1 vergleichen');
  await expect.element(page.getByText('Wiederaufnahme als neuer privater Entwurf')).toBeVisible();
  await activate('Schließen');
  await activate('Lokalen Entwurf 1 vergleichen');
  await expect.element(page.getByText('Wiederaufnahme als neuer privater Entwurf')).toBeVisible();
  await activate('Als neuen Entwurf wiederaufnehmen');
  expect(c.selectWorkspace).toHaveBeenCalledWith('new');
  c.session!.reference.workspaceId = 'draft';
  ui.rerender(<CollaborationStatus client={c} />);
  await activate('Entwurf auf aktuellen Haupttext beziehen');
  expect(api).toHaveBeenCalledWith('rebase', expect.anything());
  c.session!.reference.workspaceId = null;
  ui.rerender(<CollaborationStatus client={c} />);
  const summary = page.getByText('Gespeicherte Fassungen').element() as HTMLElement;
  summary.focus();
  await userEvent.keyboard('{Enter}');
  await activate('Fassungen laden');
  await expect.element(page.getByText('Revision 1 · edit')).toBeVisible();
  await activate('Als neue Generation wiederherstellen');
  expect(api).toHaveBeenCalledWith('restore', expect.objectContaining({ value: 'History' }));
});
it('retains decision results while keyboard users retry conflicts or start a new proposal', async () => {
  const c = client();
  api.mockImplementation(async (op: string) =>
    op === 'proposals'
      ? [
          {
            id: 'cr',
            title: 'Decision',
            preview: null,
            previewConflict: true,
            decisionResult: 'passed',
            applicationStatus: 'conflict',
          },
        ]
      : { revision: 2 }
  );
  const ui = render(<ProposalViews client={c} />);
  await expect.element(page.getByText('Decision · passed · conflict')).toBeVisible();
  const summary = page.getByText('Decision · passed · conflict').element() as HTMLElement;
  summary.focus();
  await userEvent.keyboard('{Enter}');
  await activate('Anwendung erneut prüfen');
  await activate('Neuen Änderungsantrag entwerfen');
  expect(c.createDraft).toHaveBeenCalledWith('proposal');
  expect(api).toHaveBeenCalledWith(
    'retryDecision',
    expect.objectContaining({ changeRequestId: 'cr' })
  );
  api.mockImplementation(async (op: string) =>
    op === 'proposals'
      ? [
          {
            id: 'cr',
            title: 'Pending',
            preview: null,
            decisionResult: null,
            applicationStatus: 'pending',
            canResolve: true,
          },
        ]
      : { status: 'applied' }
  );
  c.session!.generation = 'new';
  ui.rerender(<ProposalViews client={c} />);
  await expect.element(page.getByText('Pending · Eingereicht · pending')).toBeVisible();
  const pending = page.getByText('Pending · Eingereicht · pending').element() as HTMLElement;
  pending.focus();
  if (!(pending.parentElement as HTMLDetailsElement).open) await userEvent.keyboard('{Enter}');
  await activate('Annehmen');
  expect(api).toHaveBeenCalledWith('resolve', expect.objectContaining({ result: 'accepted' }));
});
