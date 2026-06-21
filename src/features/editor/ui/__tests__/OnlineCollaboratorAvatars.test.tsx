/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OnlineCollaboratorAvatars } from '../OnlineCollaboratorAvatars';
import { generateDistinctUserColorMap } from '../../logic/editor-helpers';
import type { EditorCollaborator, EditorPresencePeer } from '../../types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    resetScroll: _resetScroll,
    ...props
  }: {
    to: string;
    children: ReactNode;
    resetScroll?: boolean;
  }) => {
    void _resetScroll;

    return (
      <a href={to} {...props}>
        {children}
      </a>
    );
  },
}));

afterEach(cleanup);

function collaborator(id: string, user: EditorCollaborator['user']): EditorCollaborator {
  return {
    id,
    user,
    canEdit: true,
    status: 'collaborator',
  };
}

const collaborators: EditorCollaborator[] = [
  collaborator('collab-online', {
    id: 'user-online',
    name: 'Tobias Hassebrock',
    firstName: 'Tobias',
    lastName: 'Hassebrock',
  }),
  collaborator('collab-cursor', {
    id: 'user-cursor',
    name: 'Charly Cursor',
    firstName: 'Charly',
    lastName: 'Cursor',
  }),
  collaborator('collab-current', {
    id: 'user-current',
    name: 'Mia Current',
    firstName: 'Mia',
    lastName: 'Current',
  }),
  collaborator('collab-offline', {
    id: 'user-offline',
    name: 'Fabian Offline',
    firstName: 'Fabian',
    lastName: 'Offline',
  }),
];

const onlinePeerMap = new Map<string, EditorPresencePeer>([
  [
    'user-online',
    {
      peerId: 'peer-online',
      userId: 'user-online',
      name: 'Tobias Hassebrock',
      color: 'hsl(120 60% 45%)',
    },
  ],
]);

function renderAvatars() {
  render(
    <OnlineCollaboratorAvatars
      collaborators={collaborators}
      onlinePeerMap={onlinePeerMap}
      activeCursorUserIds={new Set(['user-cursor'])}
      currentUserId="user-current"
    />
  );
}

function getRenderedPresenceDotColor(accessibleName: string) {
  const button = screen.getByRole('button', { name: accessibleName });
  const dot = button.querySelector('span[aria-hidden="true"]') as HTMLElement | null;

  if (!dot) {
    throw new Error(`Presence dot for ${accessibleName} was not rendered`);
  }

  return dot.style.backgroundColor;
}

describe('OnlineCollaboratorAvatars', () => {
  it('shows only collaborators who are online, active, or the current user', () => {
    renderAvatars();

    expect(screen.getByRole('button', { name: 'Tobias Hassebrock' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Charly Cursor' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mia Current' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fabian Offline' })).toBeNull();
    expect(screen.getByText('TH')).toBeTruthy();
    expect(screen.queryByText(/user online/i)).toBeNull();
    expect(screen.queryByText(/Mitarbeiter|Collaborators/i)).toBeNull();
  });

  it('opens the profile popup on click with name details and a real profile link', async () => {
    renderAvatars();

    fireEvent.click(screen.getByRole('button', { name: 'Tobias Hassebrock' }));

    expect(await screen.findByText('First name')).toBeTruthy();
    expect(screen.getByText('Tobias')).toBeTruthy();
    expect(screen.getByText('Hassebrock')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open profile' }).getAttribute('href')).toBe(
      '/user/user-online'
    );
  });

  it('opens the profile popup on hover', async () => {
    renderAvatars();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Tobias Hassebrock' }));

    expect(await screen.findByRole('link', { name: 'Open profile' })).toBeTruthy();
  });

  it('renders distinct colors for collaborators with matching deterministic seed prefixes', () => {
    const seedUsers: EditorCollaborator['user'][] = [
      {
        id: 'f1000000-0000-4000-a000-000000000001',
        name: 'Tobias Seed',
        firstName: 'Tobias',
        lastName: 'Seed',
      },
      {
        id: 'f1000000-0000-4000-a000-000000000002',
        name: 'Vidhisha Seed',
        firstName: 'Vidhisha',
        lastName: 'Seed',
      },
      {
        id: 'f1000000-0000-4000-a000-000000000003',
        name: 'John Seed',
        firstName: 'John',
        lastName: 'Seed',
      },
      {
        id: 'f1000000-0000-4000-a000-000000000004',
        name: 'Denis Seed',
        firstName: 'Denis',
        lastName: 'Seed',
      },
    ];
    const seedCollaborators = seedUsers.map((user, index) =>
      collaborator(`seed-collab-${index}`, user)
    );
    const seedOnlinePeerMap = new Map<string, EditorPresencePeer>(
      seedUsers.map(user => [
        user.id,
        {
          peerId: `peer-${user.id}`,
          userId: user.id,
          name: user.name,
          color: 'hsl(16, 70%, 50%)',
        },
      ])
    );

    render(
      <OnlineCollaboratorAvatars
        collaborators={seedCollaborators}
        onlinePeerMap={seedOnlinePeerMap}
        activeCursorUserIds={new Set()}
        presenceColorByUserId={generateDistinctUserColorMap(seedUsers.map(user => user.id))}
      />
    );

    const renderedColors = seedUsers.map(user => getRenderedPresenceDotColor(user.name));

    expect(new Set(renderedColors).size).toBe(seedUsers.length);
  });
});
