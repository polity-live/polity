import { beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  sql: vi.fn(),
  access: vi.fn(),
  collaboration: vi.fn(),
  sharing: vi.fn(),
}));
vi.mock('../db', async original => ({
  ...(await original<typeof import('../db')>()),
  studioSql: () => io.sql,
  assertStudioAccess: io.access,
  assertStudioCollaborationAccess: io.collaboration,
}));
vi.mock('../ai-sources', () => ({ assertProjectAiSourceSharing: io.sharing }));
import {
  setProjectVisibility,
  setProjectTemplate,
  deleteStudioProject,
  cancelStudioExport,
  claimEditorActions,
  completeEditorAction,
} from '../project-commands';
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(io.sql, { json: (v: unknown) => v });
});
it('preserves owner and group authorization for visibility and templates including AI audience validation', async () => {
  for (const row of [undefined, { owner_id: 'other', group_id: null }]) {
    io.sql.mockResolvedValue(row ? [row] : []);
    await expect(setProjectTemplate('actor', 'p', true)).rejects.toMatchObject({ status: 403 });
  }
  io.sql.mockResolvedValue([{ owner_id: 'actor', group_id: null }]);
  expect(await setProjectVisibility('actor', 'p', 'public')).toEqual({ ok: true });
  expect(io.sharing).toHaveBeenCalledWith('p', [], 'public', io.sql);
  expect(io.access).toHaveBeenCalledWith('actor', 'p', true, io.sql);
  io.sql.mockResolvedValue([{ owner_id: 'other', group_id: 'g' }]);
  expect(await setProjectTemplate('actor', 'p', false)).toEqual({ ok: true });
  io.access.mockRejectedValueOnce(new Error('revoked'));
  await expect(setProjectVisibility('actor', 'p', 'private')).rejects.toThrow('revoked');
});
it('refuses deleting published media and pending exports but deletes an unused owned project', async () => {
  for (const blocker of ['statement', 'pending', 'none']) {
    io.sql.mockImplementation(async (parts: TemplateStringsArray) => {
      const text = parts.join('');
      if (text.includes('select owner_id')) return [{ owner_id: 'actor', group_id: null }];
      if (text.includes('join studio_export')) return blocker === 'statement' ? [{}] : [];
      if (text.includes('status in')) return blocker === 'pending' ? [{}] : [];
      return [];
    });
    if (blocker === 'none') expect(await deleteStudioProject('actor', 'p')).toEqual({ ok: true });
    else
      await expect(deleteStudioProject('actor', 'p')).rejects.toThrow(
        blocker === 'statement' ? 'Polity post' : 'pending exports'
      );
  }
});
it('requires export edit rights and uses atomic claims and claim-owner checks for editor results', async () => {
  io.sql.mockResolvedValue([]);
  await expect(cancelStudioExport('actor', 'job')).rejects.toMatchObject({ status: 404 });
  io.sql.mockResolvedValue([{ project_id: 'p' }]);
  expect(await cancelStudioExport('actor', 'job')).toEqual({ ok: true });
  await claimEditorActions('actor', 'p', 'client');
  expect(io.collaboration).toHaveBeenCalledWith('actor', 'p', io.sql);
  expect(io.sql.mock.lastCall?.[0].join('')).toContain('for update skip locked');
  const input = {
    projectId: 'p',
    id: 'action',
    clientId: 'client',
    result: { status: 'completed' },
  };
  for (const row of [undefined, { claimed_by: 'other' }]) {
    io.sql.mockResolvedValue(row ? [row] : []);
    await expect(completeEditorAction('actor', input)).rejects.toMatchObject({ status: 403 });
  }
  io.sql.mockResolvedValue([{ claimed_by: 'client' }]);
  expect(await completeEditorAction('actor', input)).toEqual({ status: 'acknowledged' });
  expect(io.sql.mock.lastCall?.[0].join('')).toContain('result is null');
});
