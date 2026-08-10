/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useEditorUsers } from '../useEditorUsers';
import type { EditorEntity, EditorUser } from '../../types';

function entity(value: Record<string, unknown>) {
  return value as unknown as EditorEntity;
}

function user(value: Record<string, unknown>) {
  return value as unknown as EditorUser;
}

describe('useEditorUsers', () => {
  it('returns an empty map without an entity or current user', () => {
    expect(renderHook(() => useEditorUsers(null)).result.current).toEqual({});
  });

  it('maps the current user with fallback and explicit display fields', () => {
    expect(
      renderHook(() => useEditorUsers(null, user({ id: 'current', name: '', avatarUrl: '' })))
        .result.current
    ).toEqual({
      current: {
        id: 'current',
        name: 'Anonymous',
        avatarUrl: 'https://api.dicebear.com/9.x/glass/svg?seed=current',
      },
    });

    expect(
      renderHook(() =>
        useEditorUsers(null, user({ id: 'named', name: 'Ada', avatarUrl: 'ada.png' }))
      ).result.current.named
    ).toEqual({ id: 'named', name: 'Ada', avatarUrl: 'ada.png' });
  });

  it('merges owner, collaborators, and extra participants without replacing earlier users', () => {
    const editorEntity = entity({
      owner: { id: 'owner', name: '', avatarUrl: '' },
      collaborators: [
        { user: undefined },
        { user: { id: '', name: 'Missing id' } },
        { user: { id: 'current', name: 'Duplicate current', avatarUrl: 'duplicate.png' } },
        { user: { id: 'collab-fallback', name: '', avatarUrl: '' } },
        { user: { id: 'collab-named', name: 'Grace', avatarUrl: 'grace.png' } },
      ],
      extraUsers: [
        { id: '', name: 'Missing id' },
        { id: 'collab-fallback', name: 'Duplicate collaborator' },
        { id: 'extra-fallback', name: '', avatarUrl: '' },
        { id: 'extra-named', name: 'Linus', avatarUrl: 'linus.png' },
      ],
    });

    const result = renderHook(() =>
      useEditorUsers(
        editorEntity,
        user({ id: 'current', name: 'Current', avatarUrl: 'current.png' })
      )
    ).result.current;

    expect(result).toEqual({
      current: { id: 'current', name: 'Current', avatarUrl: 'current.png' },
      owner: {
        id: 'owner',
        name: 'Owner',
        avatarUrl: 'https://api.dicebear.com/9.x/glass/svg?seed=owner',
      },
      'collab-fallback': {
        id: 'collab-fallback',
        name: 'Collaborator',
        avatarUrl: 'https://api.dicebear.com/9.x/glass/svg?seed=collab-fallback',
      },
      'collab-named': { id: 'collab-named', name: 'Grace', avatarUrl: 'grace.png' },
      'extra-fallback': {
        id: 'extra-fallback',
        name: 'Participant',
        avatarUrl: 'https://api.dicebear.com/9.x/glass/svg?seed=extra-fallback',
      },
      'extra-named': { id: 'extra-named', name: 'Linus', avatarUrl: 'linus.png' },
    });
  });

  it('supports an entity without owner or optional extra users', () => {
    expect(
      renderHook(() => useEditorUsers(entity({ owner: null, collaborators: [] }))).result.current
    ).toEqual({});
  });

  it('maps explicit owner display fields', () => {
    expect(
      renderHook(() =>
        useEditorUsers(
          entity({
            owner: { id: 'owner', name: 'Owner Name', avatarUrl: 'owner.png' },
            collaborators: [],
          })
        )
      ).result.current.owner
    ).toEqual({ id: 'owner', name: 'Owner Name', avatarUrl: 'owner.png' });
  });
});
