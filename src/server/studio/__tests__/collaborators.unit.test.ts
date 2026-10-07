import { beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ notify: vi.fn(), rows: [] as any[], project: null as any }));
vi.mock('@/features/notifications/utils/notification-helpers', () => ({
  createNotification: io.notify,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('../ai-sources', () => ({
  assertProjectAiSourceSharing: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db', async original => {
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const text = parts.join('?').toLowerCase();
    if (text.includes('select project_id from studio_project_collaborator'))
      return io.rows.filter(
        row => row.id === values[0] && row.user_id === values[1] && row.status === 'invited'
      );
    if (text.includes('from studio_project\n') && text.includes('for update'))
      return io.project ? [io.project] : [];
    if (text.includes('from "user" where id='))
      return values[0] === 'missing' ? [] : [{ id: values[0] }];
    if (
      text.includes('from studio_project_collaborator c') &&
      text.includes('join studio_project p') &&
      text.includes('for update')
    )
      return io.rows
        .filter(row => row.id === values[0])
        .map(row => ({ ...row, group_id: io.project.group_id, kind: io.project.kind }));
    if (text.includes('from studio_project_collaborator') && text.includes('for update'))
      return io.rows.filter(row => row.project_id === values[0] && row.user_id === values[1]);
    if (text.includes('insert into studio_project_collaborator')) {
      io.rows.push({
        id: values[0],
        project_id: values[1],
        user_id: values[2],
        invited_by_id: values[3],
        status: 'invited',
      });
      return [];
    }
    if (text.includes('update studio_project_collaborator')) {
      const row = io.rows.find(row => row.id === values.at(-1));
      if (row) row.status = text.includes("set status='invited'") ? 'invited' : String(values[0]);
      return [];
    }
    if (text.includes('delete from studio_project_collaborator')) {
      io.rows = io.rows.filter(row => row.project_id !== values[0] || row.user_id !== values[1]);
      return [];
    }
    if (
      text.includes('from studio_project_collaborator c') &&
      text.includes('join studio_project p')
    )
      return io.rows.filter(row => row.user_id === values[0] && row.status === 'invited');
    if (text.includes('from studio_project_collaborator c') && text.includes('join "user"'))
      return io.rows;
    return [];
  };
  return {
    ...(await original<typeof import('../db')>()),
    studioSql: () => query,
    studioTransaction: async (work: (sql: unknown) => Promise<unknown>) => work(query),
  };
});
import {
  inviteStudioCollaborators,
  removeStudioCollaborator,
  respondStudioInvitation,
} from '../collaborators';

beforeEach(() => {
  io.notify.mockReset().mockResolvedValue('notification');
  io.rows = [];
  io.project = { id: 'project', title: 'Draft', owner_id: 'owner', group_id: null, kind: 'single' };
});

describe('personal Studio invitations', () => {
  it('lets only the personal project owner invite valid other users', async () => {
    await expect(inviteStudioCollaborators('stranger', 'project', ['guest'])).rejects.toMatchObject(
      { status: 403 }
    );
    io.project.group_id = 'group';
    await expect(inviteStudioCollaborators('owner', 'project', ['guest'])).rejects.toMatchObject({
      status: 403,
    });
    io.project.group_id = null;
    await expect(inviteStudioCollaborators('owner', 'project', ['owner'])).rejects.toThrow();
    await expect(inviteStudioCollaborators('owner', 'project', ['missing'])).rejects.toThrow();
    expect(io.rows).toHaveLength(0);
  });

  it('deduplicates, requires acceptance, supports reinvitation, and revokes access', async () => {
    expect(await inviteStudioCollaborators('owner', 'project', ['guest', 'guest'])).toEqual({
      invited: 1,
    });
    expect(io.rows).toHaveLength(1);
    expect(io.rows[0].status).toBe('invited');
    expect(io.notify).toHaveBeenCalledTimes(1);
    await expect(respondStudioInvitation('other', io.rows[0].id, true)).rejects.toMatchObject({
      status: 403,
    });
    expect(await respondStudioInvitation('guest', io.rows[0].id, false)).toEqual({
      status: 'declined',
    });
    await inviteStudioCollaborators('owner', 'project', ['guest']);
    expect(io.rows).toHaveLength(1);
    expect(io.rows[0].status).toBe('invited');
    expect(await respondStudioInvitation('guest', io.rows[0].id, true)).toEqual({
      status: 'active',
    });
    expect(await inviteStudioCollaborators('owner', 'project', ['guest'])).toEqual({ invited: 0 });
    await removeStudioCollaborator('owner', 'project', 'guest');
    expect(io.rows).toHaveLength(0);
  });
});
