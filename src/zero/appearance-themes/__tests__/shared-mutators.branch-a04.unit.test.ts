import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POLITY_THEME } from '@/features/shared/appearance-theme';

const canMock = vi.hoisted(() => vi.fn());

vi.mock('../../rbac/can', () => ({ can: (...args: unknown[]) => canMock(...args) }));

import { appearanceThemeSharedMutators } from '../shared-mutators';

type Input = Parameters<typeof appearanceThemeSharedMutators.updateDraft.fn>[0];

const themeId = '00000000-0000-4000-8000-000000000010';
const revisionId = '00000000-0000-4000-8000-000000000011';
const groupId = '00000000-0000-4000-8000-000000000088';

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      appearance_theme: { delete: vi.fn(), insert: vi.fn(), update: vi.fn() },
      appearance_theme_revision: { delete: vi.fn(), insert: vi.fn(), update: vi.fn() },
    },
  };
}

function ctx(): Input['ctx'] {
  return { userID: '00000000-0000-4000-8000-000000000099', email: 'admin@example.test' };
}

function validTheme() {
  return { id: themeId, kind: 'group', group_id: groupId };
}

function draftArgs() {
  return {
    id: themeId,
    theme_id: themeId,
    revision_id: revisionId,
    version: 2,
    name: 'Updated',
    description: undefined,
    light_palette: POLITY_THEME.light,
    dark_palette: POLITY_THEME.dark,
    fonts: POLITY_THEME.fonts,
  };
}

beforeEach(() => {
  canMock.mockReset();
  canMock.mockResolvedValue(undefined);
});

describe('appearance theme shared mutator remaining branches', () => {
  it.each([
    [null, 'missing'],
    [{ id: themeId, kind: 'system', group_id: groupId }, 'non-group'],
    [{ id: themeId, kind: 'group', group_id: null }, 'detached'],
  ])('rejects a %s theme before authorization', async (theme, _label) => {
    const tx = createTx();
    tx.run.mockResolvedValue(theme);

    await expect(
      appearanceThemeSharedMutators.delete.fn({
        tx: tx as never,
        ctx: ctx(),
        args: { id: themeId },
      })
    ).rejects.toThrow('Group theme not found');
    expect(canMock).not.toHaveBeenCalled();
  });

  it('updates an existing draft and inserts a missing draft with a null description', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce(validTheme()).mockResolvedValueOnce({ id: revisionId });
    await appearanceThemeSharedMutators.updateDraft.fn({
      tx: tx as never,
      ctx: ctx(),
      args: draftArgs(),
    });
    expect(tx.mutate.appearance_theme_revision.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: revisionId })
    );

    const insertTx = createTx();
    insertTx.run.mockResolvedValueOnce(validTheme()).mockResolvedValueOnce(null);
    await appearanceThemeSharedMutators.updateDraft.fn({
      tx: insertTx as never,
      ctx: ctx(),
      args: draftArgs(),
    });
    expect(insertTx.mutate.appearance_theme.update).toHaveBeenCalledWith(
      expect.objectContaining({ description: null })
    );
    expect(insertTx.mutate.appearance_theme_revision.insert).toHaveBeenCalledOnce();
  });

  it('rejects a missing draft and publishes a valid draft', async () => {
    const missingTx = createTx();
    missingTx.run.mockResolvedValueOnce(validTheme()).mockResolvedValueOnce(null);
    await expect(
      appearanceThemeSharedMutators.publish.fn({
        tx: missingTx as never,
        ctx: ctx(),
        args: { theme_id: themeId, revision_id: revisionId },
      })
    ).rejects.toThrow('Theme draft not found');

    const tx = createTx();
    tx.run.mockResolvedValueOnce(validTheme()).mockResolvedValueOnce({
      id: revisionId,
      light_palette: POLITY_THEME.light,
      dark_palette: POLITY_THEME.dark,
      fonts: POLITY_THEME.fonts,
    });
    await appearanceThemeSharedMutators.publish.fn({
      tx: tx as never,
      ctx: ctx(),
      args: { theme_id: themeId, revision_id: revisionId },
    });
    expect(tx.mutate.appearance_theme_revision.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: revisionId, status: 'published' })
    );
    expect(tx.mutate.appearance_theme.update).toHaveBeenCalledWith(
      expect.objectContaining({ current_revision_id: revisionId })
    );
  });

  it('deletes an authorized group theme', async () => {
    const tx = createTx();
    tx.run.mockResolvedValue(validTheme());

    await appearanceThemeSharedMutators.delete.fn({
      tx: tx as never,
      ctx: ctx(),
      args: { id: themeId },
    });

    expect(tx.mutate.appearance_theme.delete).toHaveBeenCalledWith({ id: themeId });
  });
});
