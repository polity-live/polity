/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCorridorCityDesignObject,
  createPointCityDesignObject,
} from '../../logic/cityDesignPlacement';
import { getCityDesignChangeRequestDiscussionId } from '../../logic/cityDesignChangeRequests';
import {
  CityDesignChangeRequestCanvasList,
  CityDesignChangeRequestPanel,
  cityDesignChangeRequestPanelInternals as helpers,
} from '../CityDesignChangeRequestPanel';

afterEach(cleanup);

const t = (key: string, fallback?: string) => fallback ?? key;

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: 'request',
    source_type: 'city_design_object',
    title: 'Request title',
    change_type: 'insert',
    status: 'open',
    voting_status: 'open',
    ...overrides,
  } as any;
}

describe('CityDesignChangeRequestPanel A04 branch accountability', () => {
  it('renders an empty canvas list without a selected close action', () => {
    const { container } = render(
      <CityDesignChangeRequestCanvasList
        changeRequests={[]}
        selectedChangeRequestId={null}
        onChangeRequestSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/no city design change requests/i)).toBeTruthy();
    expect(
      container.querySelector('[data-action-id="amendments.city-cr.close.selection"]')
    ).toBeNull();
  });

  it('covers title keyboard actions, compact layout, reject projection, and recorded votes', () => {
    const onTitleChange = vi.fn();
    const base = request({
      votes_for: 0,
      votes_against: 2,
      votes_abstain: 1,
      eligibleVoterCount: 5,
      votedCollaboratorCount: 3,
      votes: [{ userId: 'user', vote_choice: 'reject' }],
    });
    const { container, rerender } = render(
      <CityDesignChangeRequestPanel
        changeRequest={base}
        currentUserId="user"
        compact
        canVote
        canFinalize
        onTitleChange={onTitleChange}
      />
    );
    expect(container.firstElementChild?.className).toContain('max-h');
    expect(screen.getByText(/vote recorded/i)).toBeTruthy();
    fireEvent.click(container.querySelector('[data-action-id="amendments.city-cr.edit.title"]')!);
    const unchanged = screen.getByDisplayValue('Request title');
    fireEvent.keyDown(unchanged, { key: 'Enter' });
    expect(onTitleChange).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('[data-action-id="amendments.city-cr.edit.title"]')!);
    const escaped = screen.getByDisplayValue('Request title');
    fireEvent.change(escaped, { target: { value: 'Changed' } });
    fireEvent.keyDown(escaped, { key: 'Escape' });
    expect(screen.queryByDisplayValue('Changed')).toBeNull();

    rerender(
      <CityDesignChangeRequestPanel
        changeRequest={{ ...base, votes: [{ user_id: 'user', choice: 'abstain' }] }}
        currentUserId="user"
        canVote
      />
    );
    expect(screen.getAllByText(/abstain/i).length).toBeGreaterThan(1);

    rerender(
      <CityDesignChangeRequestPanel
        changeRequest={{ ...base, votes: [{ user_id: 'user', vote: 'accept' }] }}
        currentUserId="user"
        canVote
      />
    );
    expect(
      container.querySelector('[data-action-id="amendments.city-cr.vote.accept"]')?.className
    ).toContain('ring-2');
  });

  it('renders collaborator, current-user, and fallback comment authors and rich text', () => {
    render(
      <CityDesignChangeRequestPanel
        changeRequest={request()}
        currentUserId="current"
        currentUserDisplayName={null}
        discussions={[
          {
            id: 'different',
            crId: 'CR-request',
            comments: [
              {
                id: null,
                user_id: 'current',
                contentRich: [{ children: [{ text: 'Current rich' }] }],
              },
              { userId: 'collaborator', contentRich: ['Collaborator text'] },
              { userId: 'missing', contentRich: { unsupported: true } },
            ],
          },
        ]}
        collaborators={
          [
            {
              id: 'collab',
              user: { id: 'collaborator', name: 'Collaborator', avatarUrl: 'avatar' },
            },
          ] as any
        }
      />
    );
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Collaborator')).toBeTruthy();
    expect(screen.getByText('Comment')).toBeTruthy();
    expect(screen.getByText('Current rich')).toBeTruthy();
    expect(screen.getByText('Collaborator text')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    expect(screen.getByPlaceholderText(/reply/i)).toBeTruthy();
  });

  it('formats object, geometry, value, vote, discussion, author, and tone alternatives', () => {
    const point = createPointCityDesignObject({
      id: 'point-object',
      type: 'tree',
      point: { x: 0, z: 0 },
    });
    const corridor = createCorridorCityDesignObject({
      id: 'corridor-object',
      type: 'street',
      start: { x: 0, z: 0 },
      end: { x: 10, z: 0 },
      width: 4,
    });
    const path = {
      ...corridor,
      geometry: {
        ...corridor.geometry,
        kind: 'path_corridor',
        points: [
          { x: 0, z: 0 },
          { x: 10, z: 0 },
        ],
      },
    } as any;
    const polygon = {
      ...point,
      geometry: { kind: 'polygon', points: [], area: 25, rotationDeg: 0 },
    } as any;

    expect(helpers.geometryWidth(point)).toBe('-');
    expect(helpers.geometryWidth(corridor)).not.toBe('-');
    expect(helpers.geometryWidth(path)).not.toBe('-');
    expect(helpers.geometryLength(point)).toBe('-');
    expect(helpers.geometryLength(path)).not.toBe('-');
    expect(helpers.geometryArea(point)).toBe('-');
    expect(helpers.geometryArea(corridor)).not.toBe('-');
    expect(helpers.geometryArea(path)).not.toBe('-');
    expect(helpers.geometryArea(polygon)).toBe('25');
    expect(helpers.objectValueRow('key', 'Label', null, null, helpers.objectLabel)).toMatchObject({
      before: '-',
      after: '-',
      changed: false,
    });
    expect(helpers.objectValueRow('key', 'Label', point, null, helpers.objectLabel).changed).toBe(
      true
    );
    expect(helpers.buildObjectInspectorRows(null, null, t)).toEqual([]);
    expect(helpers.buildObjectInspectorRows(point, null, t).length).toBeGreaterThan(0);
    expect(helpers.buildObjectInspectorRows(null, point, t).length).toBeGreaterThan(0);
    expect(helpers.buildPropertyRows(request(), t)).toEqual([]);

    expect(helpers.formatNumber(Number.NaN)).toBe('-');
    expect(helpers.formatNumber(1.25)).toBe('1,3');
    expect(helpers.formatValue(null)).toBe('-');
    expect(helpers.formatValue('')).toBe('-');
    expect(helpers.formatValue(2)).toBe('2');
    expect(helpers.formatValue(true)).toBe('Yes');
    expect(helpers.formatValue(false)).toBe('No');
    expect(helpers.formatValue('value')).toBe('value');
    expect(helpers.getVoteCounts(request())).toEqual({ accept: 0, reject: 0, abstain: 0 });
    expect(
      helpers.getVoteCounts(request({ votes_for: 1, votes_against: 2, votes_abstain: 3 }))
    ).toEqual({ accept: 1, reject: 2, abstain: 3 });
    expect(helpers.getCurrentUserVote(request(), null)).toBeNull();
    expect(
      helpers.getCurrentUserVote(request({ votes: [{ user_id: 'user', vote: 'accept' }] }), 'user')
    ).toBe('accept');
    expect(
      helpers.getCurrentUserVote(
        request({ votes: [{ userId: 'user', vote_choice: 'reject' }] }),
        'user'
      )
    ).toBe('reject');
    expect(
      helpers.getCurrentUserVote(
        request({ votes: [{ userId: 'user', choice: 'abstain' }] }),
        'user'
      )
    ).toBe('abstain');
    expect(
      helpers.getCurrentUserVote(
        request({ votes: [{ userId: 'user', choice: 'invalid' }] }),
        'user'
      )
    ).toBeNull();
    expect(helpers.getVoteLabel('accept', t)).toBe('Accept');
    expect(helpers.getVoteLabel('reject', t)).toBe('Reject');
    expect(helpers.getVoteLabel('abstain', t)).toBe('Abstain');

    const byId = { id: getCityDesignChangeRequestDiscussionId(request()) } as any;
    const byEntity = { id: 'other', changeRequestEntityId: 'request' } as any;
    const byCr = { id: 'other', crId: 'CR-request' } as any;
    expect(helpers.getDiscussionForChangeRequest(request(), [byId])).toBe(byId);
    expect(helpers.getDiscussionForChangeRequest(request(), [byEntity])).toBe(byEntity);
    expect(helpers.getDiscussionForChangeRequest(request(), [byCr])).toBe(byCr);
    expect(helpers.getDiscussionForChangeRequest(request(), [])).toBeUndefined();

    const collaborators = [
      { user: { id: 'author', name: 'Collaborator Author', avatarUrl: 'collab-avatar' } },
    ] as any;
    expect(
      helpers.getChangeRequestAuthor(
        request({ user: { id: 'user', name: 'Named', avatar: 'avatar' } }),
        []
      )
    ).toEqual({ name: 'Named', avatarUrl: 'avatar' });
    expect(
      helpers.getChangeRequestAuthor(
        request({
          user: { id: 'user', first_name: 'Ada', last_name: 'Lovelace', avatarUrl: 'avatar-url' },
        }),
        []
      )
    ).toEqual({ name: 'Ada Lovelace', avatarUrl: 'avatar-url' });
    expect(
      helpers.getChangeRequestAuthor(
        request({ user_id: 'author', user: { id: 'author', email: 'mail@example.com' } }),
        collaborators
      ).name
    ).toBe('mail@example.com');
    expect(helpers.getChangeRequestAuthor(request({ userId: 'author' }), collaborators).name).toBe(
      'Collaborator Author'
    );
    expect(helpers.getChangeRequestAuthor(request(), []).name).toBe('Change request');
    expect(
      helpers.getCommentAuthor({ userId: 'current', collaborators: [], currentUserId: 'current' })
    ).toEqual({ name: 'You', avatarUrl: null });
    expect(
      helpers.getCommentAuthor({ userId: 'author', collaborators, currentUserId: 'current' })
    ).toEqual({ name: 'Collaborator Author', avatarUrl: 'collab-avatar' });
    expect(helpers.getCommentAuthor({ userId: null, collaborators: [] })).toEqual({
      name: 'Comment',
      avatarUrl: null,
    });
    expect(helpers.getCommentUserId({ userId: 'one', user_id: 'two' })).toBe('one');
    expect(helpers.getCommentUserId({ user_id: 'two' })).toBe('two');
    expect(helpers.getCommentUserId({})).toBeNull();

    expect(helpers.extractPlainText('plain')).toBe('plain');
    expect(helpers.extractPlainText(null)).toBe('');
    expect(
      helpers.extractPlainText([{ text: 'one' }, { children: ['two', { text: 'three' }] }, null])
    ).toBe('one\ntwothree');
    expect(helpers.extractNodeText('node')).toBe('node');
    expect(helpers.extractNodeText({ unknown: true })).toBe('');
    expect(helpers.getInitial(' Alice ')).toBe('A');
    expect(helpers.getInitial(null)).toBe('?');
    for (const tone of ['add', 'remove', 'update', 'other']) {
      expect(helpers.getToneDotClassName(tone)).toBeTruthy();
      expect(helpers.getToneBadgeClassName(tone)).toBeTruthy();
    }
  });
});
