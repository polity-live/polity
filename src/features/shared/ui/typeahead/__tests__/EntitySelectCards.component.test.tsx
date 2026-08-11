// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  editingMode: vi.fn(() => 'collaborative'),
  orderedBranches: vi.fn((branches: unknown[]) => branches),
  translate: vi.fn((key: string, values?: { count: number }) =>
    values ? `${key}:${values.count}` : key
  ),
}));

vi.mock('@/features/amendments/logic/amendmentBranchDisplay', () => ({
  getBranchEditingMode: mocks.editingMode,
  getOrderedBranches: mocks.orderedBranches,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: mocks.translate }));

vi.mock('@/features/shared/theme', () => ({
  getEntityGradientClasses: (tone: string) => `gradient-${tone}`,
  getEntityToneClasses: (tone: string) => ({ badge: `badge-${tone}`, border: `border-${tone}` }),
  getMotionPreset: () => 'hover-lift',
  getRoleToneClasses: () => ({ badge: 'badge-role' }),
}));

vi.mock('@/features/shared/ui/status/EditingMode', () => ({
  EditingModeBadge: ({ mode }: { mode: string }) => <span>mode:{mode}</span>,
}));

vi.mock('@/features/shared/ui/ui/badge.tsx', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('@/features/shared/ui/ui/card.tsx', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <section {...props}>{children}</section>
  ),
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-part="content" {...props}>
      {children}
    </div>
  ),
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  ),
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <header {...props}>{children}</header>
  ),
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props}>{children}</h2>
  ),
}));

vi.mock('lucide-react', () => ({
  Calendar: () => <i>calendar</i>,
  FileText: () => <i>file</i>,
  MapPin: () => <i>pin</i>,
  Scale: () => <i>scale</i>,
  Users: () => <i>users</i>,
}));

import {
  AgendaItemSelectCard,
  AmendmentSelectCard,
  AmendmentVoteSelectCard,
  ElectionSelectCard,
  EventSelectCard,
  GroupSelectCard,
  RoleSelectCard,
} from '../EntitySelectCards';

afterEach(cleanup);

describe('EntitySelectCards', () => {
  it('renders all optional event details and omits absent details', () => {
    const first = render(
      <EventSelectCard
        event={{
          group: { name: 'Civic Group' },
          location: 'Berlin',
          startDate: new Date(2025, 0, 2),
          title: 'Assembly',
        }}
      />
    );
    expect(screen.getByText('Assembly')).toBeTruthy();
    expect(screen.getByText('Berlin')).toBeTruthy();
    expect(screen.getByText('Civic Group')).toBeTruthy();
    expect(screen.getByText(/Jan 2, 2025/)).toBeTruthy();
    first.unmount();

    const second = render(<EventSelectCard event={{ title: 'Bare event' }} />);
    expect(second.container.querySelector('[data-part="content"]')).toBeNull();
    second.unmount();

    const locationOnly = render(<EventSelectCard event={{ location: 'Leipzig' }} />);
    expect(screen.getByText('Leipzig')).toBeTruthy();
    expect(screen.queryByText('Civic Group')).toBeNull();
    locationOnly.unmount();

    render(<EventSelectCard event={{ group: { name: 'Only group' } }} />);
    expect(screen.getByText('Only group')).toBeTruthy();
  });

  it('renders populated and empty group cards', () => {
    const populated = render(
      <GroupSelectCard group={{ description: 'Open to everyone', memberCount: 3, name: 'Group' }} />
    );
    expect(screen.getByText('Open to everyone')).toBeTruthy();
    expect(screen.getByText(/components.labels.members:3/)).toBeTruthy();
    populated.unmount();

    const empty = render(<GroupSelectCard group={{ memberCount: 0, name: 'Empty' }} />);
    expect(empty.container.querySelector('[data-part="content"]')).toBeNull();
    expect(screen.queryByText('Open to everyone')).toBeNull();
  });

  it('selects an amendment branch and handles missing branch containers', () => {
    const branch = { id: 'branch-1', editing_mode: 'collaborative' };
    const populated = render(
      <AmendmentSelectCard
        amendment={{
          current_process_run: { branches: [branch] },
          subtitle: 'A subtitle',
          title: 'Proposal',
        }}
      />
    );
    expect(screen.getByText('A subtitle')).toBeTruthy();
    expect(screen.getByText('mode:collaborative')).toBeTruthy();
    expect(mocks.editingMode).toHaveBeenCalledWith(branch);
    populated.unmount();

    const noRun = render(<AmendmentSelectCard amendment={{ title: 'No run' }} />);
    expect(noRun.container.querySelector('[data-part="content"]')).toBeNull();
    noRun.unmount();

    render(
      <AmendmentSelectCard
        amendment={{ current_process_run: { branches: null }, title: 'Null list' }}
      />
    );
    expect(mocks.orderedBranches).toHaveBeenLastCalledWith([]);
  });

  it('renders election and amendment-vote descriptions and statuses conditionally', () => {
    const election = render(
      <ElectionSelectCard
        election={{ description: 'Election details', status: 'open', title: 'Board' }}
      />
    );
    expect(screen.getByText('Election details')).toBeTruthy();
    expect(screen.getByText('open')).toBeTruthy();
    election.unmount();

    const bareElection = render(<ElectionSelectCard election={{ title: 'Bare election' }} />);
    expect(bareElection.container.querySelector('[data-part="content"]')).toBeNull();
    bareElection.unmount();

    const vote = render(
      <AmendmentVoteSelectCard
        amendmentVote={{ description: 'Vote details', status: 'closed', title: 'Vote' }}
      />
    );
    expect(screen.getByText('Vote details')).toBeTruthy();
    expect(screen.getByText('closed')).toBeTruthy();
    vote.unmount();

    const bareVote = render(<AmendmentVoteSelectCard amendmentVote={{ title: 'Bare vote' }} />);
    expect(bareVote.container.querySelector('[data-part="content"]')).toBeNull();
  });

  it('renders role details independently', () => {
    const complete = render(
      <RoleSelectCard
        role={{
          description: 'Coordinates work',
          group: { name: 'Council' },
          term: 12,
          title: 'Chair',
        }}
      />
    );
    expect(screen.getByText('Coordinates work')).toBeTruthy();
    expect(screen.getByText('Council')).toBeTruthy();
    expect(screen.getByText(/12/)).toBeTruthy();
    complete.unmount();

    const bare = render(<RoleSelectCard role={{ title: 'Member' }} />);
    expect(bare.container.querySelector('[data-part="content"]')?.textContent).toBe('');
    bare.unmount();

    render(<RoleSelectCard role={{ group: { name: 'Group only' }, title: 'Group role' }} />);
    expect(screen.getByText('Group only')).toBeTruthy();
  });

  it('renders agenda event titles only when present', () => {
    const populated = render(
      <AgendaItemSelectCard
        agendaItem={{ event: { title: 'Annual meeting' }, title: 'Budget', type: 'motion' }}
      />
    );
    expect(screen.getByText('Annual meeting')).toBeTruthy();
    populated.unmount();

    render(<AgendaItemSelectCard agendaItem={{ event: null, title: 'No event', type: 'note' }} />);
    expect(screen.queryByText('Annual meeting')).toBeNull();
  });
});
