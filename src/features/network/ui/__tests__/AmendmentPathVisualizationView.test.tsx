/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  civicProps: [] as any[],
  language: 'en',
}));

vi.mock('@/features/network/ui/CivicNetworkFlow', () => ({
  CivicNetworkFlow: (props: any) => {
    state.civicProps.push(props);
    return (
      <div>
        {props.nodes.map((node: any) => (
          <div key={node.id}>{node.data.label}</div>
        ))}
      </div>
    );
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/global-state/language.store', () => ({
  useLanguageStore: { getState: () => ({ language: state.language }) },
}));

import { AmendmentPathVisualizationView } from '../AmendmentPathVisualizationView';

beforeEach(() => {
  state.civicProps = [];
  state.language = 'en';
});

afterEach(cleanup);

const statuses = [
  'approved',
  'forward_confirmed',
  'pending_event',
  'rejected',
  'accepted',
  'supported',
  'merged',
  'completed',
  'scheduled',
  'in_vote',
  'withdrawn',
  'previous_decision_outstanding',
  'tie',
  'custom',
  null,
] as const;

function segments() {
  return statuses.map((forwardingStatus, index) => ({
    groupId: index % 3 === 0 ? `group-${index}` : null,
    groupName: index % 2 === 0 ? `Group ${index}` : '',
    eventId: index < 2 ? `event-${index}` : null,
    eventTitle: `Event ${index}`,
    eventStartDate: index === 0 ? 1 : null,
    agendaItemId: null,
    amendmentVoteId: null,
    forwardingStatus,
    order: index,
    isActiveStep: index === statuses.length - 1,
    eventRequestPending: index === 2,
  }));
}

describe('AmendmentPathVisualizationView', () => {
  it('builds every status, caption, role, edge, click, locale, and panel branch', () => {
    const onGroupClick = vi.fn();
    const onNodeClick = vi.fn();
    const onLegendOpenChange = vi.fn();
    const data = segments();
    const { rerender } = render(
      <AmendmentPathVisualizationView
        enrichedPathData={data as any}
        onGroupClick={onGroupClick}
        onNodeClick={onNodeClick}
        legendOpen={false}
        onLegendOpenChange={onLegendOpenChange}
      />
    );
    let props = state.civicProps.at(-1);
    expect(props.nodes).toHaveLength(data.length * 2);
    expect(props.edges).toHaveLength(data.length * 2 - 1);
    expect(props.edges.some((edge: any) => edge.animated)).toBe(true);
    expect(props.edges.some((edge: any) => edge.style.strokeDasharray)).toBe(true);
    expect(props.legendSections).toHaveLength(3);

    props.onNodeClick({}, { data: { groupId: 'group-click' } });
    props.onNodeClick({}, { data: { eventId: 'event-click' } });
    props.onNodeClick({}, { data: { groupId: 42, eventId: 42 } });
    expect(onGroupClick).toHaveBeenCalledWith('group-click');
    expect(onNodeClick).toHaveBeenCalledWith('event-click');
    props.panelConfig.onPanelCollapsedChange(false);
    props.panelConfig.onLegendCollapsedChange(true);
    props.panelConfig.onInteractiveChange(false);
    expect(onLegendOpenChange).toHaveBeenCalledWith(false);

    state.language = 'de';
    rerender(
      <AmendmentPathVisualizationView
        enrichedPathData={data as any}
        groupTypeById={
          new Map([
            ['group-0', 'hierarchical'],
            ['group-3', null],
          ])
        }
        legendOpen
        onLegendOpenChange={onLegendOpenChange}
      />
    );
    props = state.civicProps.at(-1);
    props.onNodeClick({}, { data: { groupId: 'group-without-handler' } });
    props.onNodeClick({}, { data: { eventId: 'event-without-handler' } });
    expect(props.panelConfig.legendCollapsed).toBe(false);
  });
});
