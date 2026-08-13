import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POLITY_THEME } from '@/features/shared/appearance-theme';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { appearanceThemeSharedMutators } from '../shared-mutators';

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
