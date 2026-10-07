import { expect, it } from 'vitest';
import { buildStudioPresence } from '../studio-presence';
import { generateDistinctUserColorMap } from '@/features/editor/logic/editor-helpers';

it('keeps the roster empty before an identity or peers are available', () => {
  const result = buildStudioPresence({ id: '', name: '' }, []);
  expect(result.collaborators).toEqual([]);
  expect(result.onlinePeerMap.size).toBe(0);
  expect(result.presenceColorByUserId.size).toBe(0);
  expect(result.activeCursorUserIds.size).toBe(0);
});

it('deduplicates peers, omits the local user and anonymous entries, and retains the newest peer', () => {
  const identity = {
    id: 'local',
    name: 'Local',
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatarUrl: '/local.png',
  };
  const result = buildStudioPresence(identity, [
    {},
    { userId: '' },
    { userId: 'local' },
    { userId: 'peer', user: { name: 'Old' } },
    {
      userId: 'peer',
      user: {
        name: 'New',
        firstName: 'Grace',
        lastName: 'Hopper',
        avatar: '/peer.png',
        color: '#fff',
      },
      cursor: { pageId: 'frame' },
    },
    { user: { id: 'nested', name: '' } },
    { userId: 'without-user' },
  ]);
  expect(result.collaborators.map(entry => entry.user.id)).toEqual([
    'local',
    'peer',
    'nested',
    'without-user',
  ]);
  expect(result.collaborators[0].user).toEqual(identity);
  expect(result.onlinePeerMap.get('peer')).toEqual({
    peerId: 'peer',
    userId: 'peer',
    name: 'New',
    avatar: '/peer.png',
    color: generateDistinctUserColorMap(['local', 'peer', 'nested', 'without-user']).get('peer'),
  });
  expect(result.onlinePeerMap.get('nested')).toMatchObject({ name: 'Polity', avatar: undefined });
  expect(result.onlinePeerMap.get('without-user')).toMatchObject({
    name: 'Polity',
    avatar: undefined,
  });
  expect([...result.activeCursorUserIds]).toEqual(['peer']);
  expect(new Set(result.presenceColorByUserId.values()).size).toBe(4);
});

it('shows known remote peers while the local identity is still loading', () => {
  const result = buildStudioPresence({ id: '', name: '' }, [
    { user: { id: 'remote', name: 'Remote', avatar: null } },
  ]);
  expect(result.collaborators).toHaveLength(1);
  expect(result.collaborators[0].user).toMatchObject({
    id: 'remote',
    name: 'Remote',
    avatarUrl: undefined,
  });
  expect(result.onlinePeerMap.get('remote')?.color).toBe(
    result.presenceColorByUserId.get('remote')
  );
});
