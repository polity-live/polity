/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ viewProps: [] as any[] }));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../NetworkEntityDialogView', () => ({
  NetworkEntityDialogView: (props: any) => {
    state.viewProps.push(props);
    return <div data-testid="entity-dialog-view" />;
  },
}));

import { NetworkEntityDialog } from '../NetworkEntityDialog';

afterEach(cleanup);

beforeEach(() => {
  state.viewProps = [];
});

function relationship(overrides: Record<string, unknown> = {}) {
  return {
    source: 'current',
    target: 'selected',
    sourceName: 'Current',
    targetName: 'Selected',
    relationshipType: 'parent',
    currentGroupId: 'current',
    currentGroupName: 'Current',
    selectedGroupId: 'selected',
    selectedGroupName: 'Selected',
    rights: ['amendmentRight'],
    ...overrides,
  } as any;
}

describe('NetworkEntityDialog adapter contracts', () => {
  it('returns nothing without an entity and forwards non-relationship entities', () => {
    const { rerender } = render(<NetworkEntityDialog open onOpenChange={vi.fn()} entity={null} />);
    expect(state.viewProps).toHaveLength(0);

    rerender(
      <NetworkEntityDialog
        open
        onOpenChange={vi.fn()}
        entity={{ type: 'group', data: { id: 'group-1', name: 'Council' } }}
      />
    );
    expect(state.viewProps.at(-1).relationshipPreviewData).toBeNull();
    expect(state.viewProps.at(-1).siblingMembershipMode).toBeUndefined();
  });

  it('normalizes labels, sentences, statuses, directions, and sibling membership modes', () => {
    const { rerender } = render(
      <NetworkEntityDialog
        open
        onOpenChange={vi.fn()}
        entity={{
          type: 'relationship',
          data: relationship({ relationshipType: 'sibling', membershipMode: 'role_members' }),
        }}
      />
    );
    let props = state.viewProps.at(-1);
    expect(props.siblingMembershipMode).toBe('elected');
    expect(
      ['active', 'incoming', 'outgoing', 'custom'].map(props.getRelationshipKindLabel)
    ).toEqual([
      'common.network.active',
      'common.network.incomingRequest',
      'common.network.outgoingRequest',
      'custom',
    ]);

    expect(props.getRelationshipSentence(relationship({ relationshipType: 'parent' }))).toContain(
      'common.network.parent'
    );
    expect(props.getRelationshipSentence(relationship({ relationshipType: 'sibling' }))).toContain(
      'common.network.sibling'
    );
    expect(
      props.getRelationshipSentence(
        relationship({
          relationshipType: 'other',
          label: 'Label',
          sourceName: null,
          source: 'Source id',
          targetName: null,
          target: 'Target id',
        })
      )
    ).toBe('Label');
    expect(
      props.getRelationshipSentence(
        relationship({
          relationshipType: 'other',
          label: null,
          sourceName: null,
          source: null,
          targetName: null,
          target: null,
        })
      )
    ).toBeNull();

    expect(
      Array.from(
        props
          .getExistingRightStatuses({
            rightRelationshipKinds: {
              accepted: 'active',
              incoming: 'incoming',
              outgoing: 'outgoing',
              ignored: 'other',
            },
          })
          .entries()
      )
    ).toEqual([
      ['accepted', 'accepted'],
      ['incoming', 'incoming'],
      ['outgoing', 'outgoing'],
    ]);
    expect(props.getExistingRightStatuses({}).size).toBe(0);

    expect(props.getRightDirectionDetails({})).toEqual([]);
    expect(props.getRightDirectionDetails(relationship({ rights: [] }))).toEqual([]);
    expect(
      props.getRightDirectionDetails(
        relationship({
          rights: ['amendmentRight', 'voteRight', 'commentRight'],
          rightDisplayDirections: { amendmentRight: 'mutual' },
          rightEdgeDirections: { voteRight: 'backward' },
        })
      )
    ).toHaveLength(3);

    rerender(
      <NetworkEntityDialog
        open
        onOpenChange={vi.fn()}
        entity={{
          type: 'relationship',
          data: relationship({ relationshipType: 'sibling', membershipMode: 'unknown' }),
        }}
      />
    );
    props = state.viewProps.at(-1);
    expect(props.siblingMembershipMode).toBeUndefined();

    rerender(
      <NetworkEntityDialog
        open
        onOpenChange={vi.fn()}
        entity={{ type: 'relationship', data: relationship({ relationshipType: 'parent' }) }}
      />
    );
    expect(state.viewProps.at(-1).siblingMembershipMode).toBeUndefined();
  });
});
