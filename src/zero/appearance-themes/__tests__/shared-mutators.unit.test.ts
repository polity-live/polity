import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POLITY_THEME } from '@/features/shared/appearance-theme';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { appearanceThemeSharedMutators } from '../shared-mutators';
import { PermissionError } from '../../rbac/errors';

type MutatorInput = Parameters<typeof appearanceThemeSharedMutators.createGroup.fn>[0];

function createTx() {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location: 'server' as const,
    run: vi.fn(),
    mutate: {
      appearance_theme: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      appearance_theme_revision: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function createCtx(): MutatorInput['ctx'] {
  return {
    userID: '00000000-0000-4000-8000-000000000099',
    email: 'theme-admin@example.com',
  };
}

beforeEach(() => {
  canMock.mockReset();
  canMock.mockResolvedValue(undefined);
});

describe('appearance theme mutator authorization and publication', () => {
  const personalArgs = {
    id: '00000000-0000-4000-8000-000000000010',
    revision_id: '00000000-0000-4000-8000-000000000011',
    slug: 'personal-copy',
    name: 'Personal copy',
    light_palette: POLITY_THEME.light,
    dark_palette: POLITY_THEME.dark,
    fonts: POLITY_THEME.fonts,
  };

  it.each([undefined, null, '', 'anon'])(
    'rejects anonymous personal creation before either insert (%s)',
    async userID => {
      const tx = createTx();
      await expect(
        appearanceThemeSharedMutators.createPersonal.fn({
          tx: tx as never,
          ctx: { ...createCtx(), userID } as MutatorInput['ctx'],
          args: personalArgs,
        })
      ).rejects.toBeInstanceOf(PermissionError);
      expect(tx.mutate.appearance_theme.insert).not.toHaveBeenCalled();
      expect(tx.mutate.appearance_theme_revision.insert).not.toHaveBeenCalled();
    }
  );

  it('creates both personal rows for the authenticated owner', async () => {
    const tx = createTx();
    const ctx = createCtx();
    await appearanceThemeSharedMutators.createPersonal.fn({
      tx: tx as never,
      ctx,
      args: personalArgs,
    });
    expect(tx.mutate.appearance_theme.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: personalArgs.id, kind: 'personal', created_by_id: ctx.userID })
    );
    expect(tx.mutate.appearance_theme_revision.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: personalArgs.revision_id,
        theme_id: personalArgs.id,
        created_by_id: ctx.userID,
      })
    );
  });

  it('preserves optimistic personal creation before authoritative server authorization', async () => {
    const tx = { ...createTx(), location: 'client' as const };
    await appearanceThemeSharedMutators.createPersonal.fn({
      tx: tx as never,
      ctx: { ...createCtx(), userID: 'anon' },
      args: personalArgs,
    });
    expect(tx.mutate.appearance_theme.insert).toHaveBeenCalledOnce();
    expect(tx.mutate.appearance_theme_revision.insert).toHaveBeenCalledOnce();
  });

  it.each(['updateDraft', 'publish', 'delete'] as const)(
    'locally rejects %s of an editor-restricted unreadable theme without any writes',
    async operation => {
      for (const userID of ['anon', createCtx().userID]) {
        const tx = { ...createTx(), location: 'client' as const };
        tx.run.mockResolvedValue(undefined);
        const input = {
          tx: tx as never,
          ctx: { ...createCtx(), userID },
          args: {
            ...personalArgs,
            theme_id: personalArgs.id,
            version: 1,
          },
        };
        await expect(appearanceThemeSharedMutators[operation].fn(input)).rejects.toThrow(
          'Theme not found'
        );
        expect(canMock).not.toHaveBeenCalled();
        for (const table of Object.values(tx.mutate))
          for (const write of Object.values(table)) expect(write).not.toHaveBeenCalled();
      }
    }
  );

  it('requires groupThemes/manage when creating a group theme', async () => {
    const tx = createTx();
    const groupId = '00000000-0000-4000-8000-000000000088';

    await appearanceThemeSharedMutators.createGroup.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: '00000000-0000-4000-8000-000000000010',
        revision_id: '00000000-0000-4000-8000-000000000011',
        slug: 'polity-copy',
        group_id: groupId,
        name: 'Polity copy',
        description: null,
        light_palette: POLITY_THEME.light,
        dark_palette: POLITY_THEME.dark,
        fonts: POLITY_THEME.fonts,
      },
    });

    expect(canMock).toHaveBeenCalledWith(tx, createCtx(), {
      action: 'manage',
      resource: 'groupThemes',
      groupId,
    });
    expect(tx.mutate.appearance_theme.insert).toHaveBeenCalledOnce();
    expect(tx.mutate.appearance_theme_revision.insert).toHaveBeenCalledOnce();
  });

  it('does not write a theme when authorization is denied', async () => {
    const tx = createTx();
    canMock.mockRejectedValueOnce(new Error('denied'));

    await expect(
      appearanceThemeSharedMutators.createGroup.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: '00000000-0000-4000-8000-000000000010',
          revision_id: '00000000-0000-4000-8000-000000000011',
          slug: 'polity-copy',
          group_id: '00000000-0000-4000-8000-000000000088',
          name: 'Polity copy',
          description: null,
          light_palette: POLITY_THEME.light,
          dark_palette: POLITY_THEME.dark,
          fonts: POLITY_THEME.fonts,
        },
      })
    ).rejects.toThrow('denied');

    expect(tx.mutate.appearance_theme.insert).not.toHaveBeenCalled();
  });

  it('blocks publication of drafts that fail WCAG AA', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({
        id: '00000000-0000-4000-8000-000000000010',
        kind: 'group',
        group_id: '00000000-0000-4000-8000-000000000088',
      })
      .mockResolvedValueOnce({
        id: '00000000-0000-4000-8000-000000000010',
        kind: 'group',
        group_id: '00000000-0000-4000-8000-000000000088',
      })
      .mockResolvedValueOnce({
        id: '00000000-0000-4000-8000-000000000011',
        light_palette: {
          ...POLITY_THEME.light,
          foreground: POLITY_THEME.light.background,
        },
        dark_palette: POLITY_THEME.dark,
        fonts: POLITY_THEME.fonts,
      });

    await expect(
      appearanceThemeSharedMutators.publish.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          theme_id: '00000000-0000-4000-8000-000000000010',
          revision_id: '00000000-0000-4000-8000-000000000011',
        },
      })
    ).rejects.toThrow('WCAG AA');

    expect(tx.mutate.appearance_theme_revision.update).not.toHaveBeenCalled();
    expect(tx.mutate.appearance_theme.update).not.toHaveBeenCalled();
  });
});
