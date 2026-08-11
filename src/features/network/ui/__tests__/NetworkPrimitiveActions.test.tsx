/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AmendmentPathVisualization } from '../AmendmentPathVisualization';
import { FilteredNetworkFlow } from '../FilteredNetworkFlow';
import { GroupConnectionStatusCell } from '../GroupConnectionStatusCell';
import { GroupDetailsWithEvents } from '../GroupDetailsWithEvents';
import { GroupEventsListView } from '../GroupEventsListView';
import { LinksSection } from '../LinksSection';
import { NetworkControlPanel } from '../NetworkControlPanel';
import { NetworkTabs } from '../NetworkTabs';
import { RightFilters } from '../RightFilters';
import { WikiFollowButton } from '../WikiFollowButton';

const state = vi.hoisted(() => ({
  amendmentViewProps: [] as any[],
  listProps: [] as any[],
  userFlowProps: [] as any[],
  translationEmpty: false,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string) => (state.translationEmpty ? '' : key) }),
}));

vi.mock('../AmendmentPathVisualizationView', () => ({
  AmendmentPathVisualizationView: (props: any) => {
    state.amendmentViewProps.push(props);
    return (
      <button type="button" onClick={() => props.onLegendOpenChange(true)}>
        path
      </button>
    );
  },
}));

vi.mock('@/features/network/ui/UserNetworkFlow', () => ({
  UserNetworkFlow: (props: any) => {
    state.userFlowProps.push(props);
    return <div data-testid="user-network-flow" />;
  },
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: (props: any) => {
    state.listProps.push(props);
    return <div data-testid="zero-list" />;
  },
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    events: {
      calendarPage: vi.fn((input: any) => ({ kind: 'page', input })),
      byId: vi.fn((input: any) => ({ kind: 'single', input })),
    },
  },
}));

vi.mock('@/features/search/ui/EventSearchCard', () => ({
  EventSearchCard: ({ event, onSelect }: any) => (
    <button type="button" onClick={onSelect}>
      {event.id}
    </button>
  ),
}));

vi.mock('@/features/network/ui/NetworkFlowBase', () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/search/ui/GroupSearchCard', () => ({
  GroupSearchCard: () => <div data-testid="group-card" />,
}));

vi.mock('../GroupEventsList', () => ({
  GroupEventsList: () => <div data-testid="group-events" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.amendmentViewProps = [];
  state.listProps = [];
  state.userFlowProps = [];
  state.translationEmpty = false;
});

describe('network primitive stable actions', () => {
  it('adapts amendment and filtered user-flow empty, default, and controlled states', () => {
    const { rerender } = render(<AmendmentPathVisualization enrichedPathData={[]} />);
    expect(document.querySelector('[data-testid="user-network-flow"]')).toBeNull();

    rerender(<AmendmentPathVisualization enrichedPathData={null as never} />);
    rerender(
      <AmendmentPathVisualization
        enrichedPathData={[{ id: 'segment-1' } as never]}
        groupTypeById={new Map()}
      />
    );
    expect(state.amendmentViewProps.at(-1).legendOpen).toBe(false);
    fireEvent.click(document.querySelector('button')!);
    expect(state.amendmentViewProps.at(-1).legendOpen).toBe(true);
    expect(state.amendmentViewProps.at(-1).groupTypeById).toBeInstanceOf(Map);

    cleanup();
    const onGroupClick = vi.fn();
    const filtered = render(<FilteredNetworkFlow userId="user-1" onGroupClick={onGroupClick} />);
    expect(state.userFlowProps.at(-1)).toMatchObject({
      userId: 'user-1',
      title: 'Network',
      description: '',
      onGroupClick,
    });
    filtered.rerender(
      <FilteredNetworkFlow
        userId="user-2"
        filterRight="voteRight"
        title="Custom"
        description="Description"
      />
    );
    expect(state.userFlowProps.at(-1)).toMatchObject({
      userId: 'user-2',
      filterRight: 'voteRight',
      title: 'Custom',
      description: 'Description',
    });
  });

  it('executes every virtualized group-event adapter and optional selection path', () => {
    const onEventClick = vi.fn();
    const props = {
      groupId: 'group-1',
      groupName: 'Council',
      eventsLoading: false,
      futureEvents: [],
      labels: { loadingEvents: 'Loading', noUpcomingEvents: 'Empty' },
      onEventClick,
    };
    const { rerender } = render(<GroupEventsListView {...props} />);
    let list = state.listProps.at(-1);
    expect(list.historyKey).toBe('network-group-group-1-events');
    expect(
      list.getPageQuery({ limit: 10, start: null, dir: 'after', settled: true }).options.ttl
    ).toBe('5m');
    expect(
      list.getPageQuery({ limit: 10, start: null, dir: 'after', settled: false }).options.ttl
    ).toBe('none');
    expect(list.getSingleQuery({ id: 'event-1', settled: true }).options.ttl).toBe('5m');
    expect(list.getSingleQuery({ id: 'event-1', settled: false }).options.ttl).toBe('none');
    const event = { id: 'event-1', start_date: 123 };
    expect(list.getRowKey(event)).toBe('event-1');
    expect(list.toStartRow(event)).toEqual({ id: 'event-1', start_date: 123 });
    expect(list.toStartRow({ id: 'event-2', start_date: null })).toEqual({
      id: 'event-2',
      start_date: undefined,
    });
    render(list.renderRow(event));
    fireEvent.click(document.querySelector('button')!);
    expect(onEventClick).toHaveBeenCalledWith('event-1', event);
    render(list.renderSkeleton());
    render(list.renderEmpty());

    rerender(<GroupEventsListView {...props} groupId="group-2" onEventClick={undefined} />);
    list = state.listProps.at(-1);
    const rowView = render(list.renderRow({ id: 'event-3' }));
    expect(rowView.container.querySelector('button')?.onclick).toBeNull();
  });

  it('dispatches primitive network actions with keyboard-addressable controls', () => {
    const follow = vi.fn();
    const followView = render(<WikiFollowButton following={false} onClick={follow} />);
    const followButton = document.querySelector('[data-action-id="network.wiki-follow.toggle"]')!;
    fireEvent.click(followButton);
    expect(follow).toHaveBeenCalledOnce();

    followView.rerender(<WikiFollowButton following onClick={follow} />);
    fireEvent.click(document.querySelector('[data-action-id="network.wiki-follow.toggle"]')!);
    expect(follow).toHaveBeenCalledTimes(2);

    cleanup();
    const warning = vi.fn();
    render(
      <GroupConnectionStatusCell canLink={false} hasHierarchyCheck onWarningClick={warning} />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="network.connection-status.warning.open"]')!
    );
    expect(warning).toHaveBeenCalledOnce();

    cleanup();
    const close = vi.fn();
    render(
      <GroupDetailsWithEvents
        groupId="group-1"
        groupData={{ id: 'group-1', name: 'Council' } as never}
        onClose={close}
      />
    );
    const closeButton = document.querySelector('[data-action-id="network.group-details.close"]')!;
    closeButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fireEvent.click(closeButton);
    expect(close).toHaveBeenCalledOnce();

    cleanup();
    render(
      <LinksSection
        links={[{ id: 'link-1', label: 'Docs', url: 'https://example.com' }] as never}
        addLinkButton={null}
      />
    );
    const external = document.querySelector('[data-action-id="network.external-link.open"]');
    expect(external?.getAttribute('href')).toBe('https://example.com');
    expect(external?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders every group connection, details, link, and translated filter variant', () => {
    const warning = vi.fn();
    const { rerender } = render(
      <GroupConnectionStatusCell canLink={false} hasHierarchyCheck={false} />
    );
    rerender(<GroupConnectionStatusCell canLink hasHierarchyCheck />);
    rerender(<GroupConnectionStatusCell canLink={false} hasHierarchyCheck />);
    expect(
      document.querySelector('[data-action-id="network.connection-status.warning.open"]')
    ).toBeNull();
    rerender(
      <GroupConnectionStatusCell canLink={false} hasHierarchyCheck onWarningClick={warning} />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="network.connection-status.warning.open"]')!
    );
    expect(warning).toHaveBeenCalledOnce();

    cleanup();
    const details = render(
      <GroupDetailsWithEvents
        groupId="group-1"
        groupData={{ id: 'group-1', name: null } as never}
      />
    );
    expect(document.querySelector('[data-action-id="network.group-details.close"]')).toBeNull();
    details.rerender(
      <GroupDetailsWithEvents
        groupId="group-1"
        groupData={{ id: 'group-1', name: 'Council' } as never}
        onClose={vi.fn()}
        onEventClick={vi.fn()}
      />
    );

    cleanup();
    const links = render(<LinksSection links={[]} addLinkButton={<button>Add</button>} />);
    links.rerender(
      <LinksSection
        links={
          [
            { id: 'one', label: 'One', url: null },
            { id: 'two', label: 'Two', url: 'https://example.com' },
          ] as never
        }
        addLinkButton={null}
      />
    );
    expect(document.querySelectorAll('[data-action-id="network.external-link.open"]')).toHaveLength(
      2
    );

    cleanup();
    state.translationEmpty = true;
    render(<RightFilters selectedRights={new Set(['voteRight'])} onToggleRight={vi.fn()} />);
  });

  it('selects network tabs and right filters through semantic state actions', () => {
    const onTabChange = vi.fn();
    render(
      <NetworkTabs
        activeTab="current-network"
        onTabChange={onTabChange}
        currentNetworkContent={<div>current</div>}
        manageNetworkContent={<div>relationships</div>}
        manageWorkflowsContent={<div>workflows</div>}
      />
    );
    fireEvent.mouseDown(
      document.querySelector('[data-action-id="network.tab.relationships.select"]')!,
      { button: 0, ctrlKey: false }
    );
    fireEvent.mouseDown(
      document.querySelector('[data-action-id="network.tab.workflows.select"]')!,
      { button: 0, ctrlKey: false }
    );
    fireEvent.mouseDown(document.querySelector('[data-action-id="network.tab.current.select"]')!, {
      button: 0,
      ctrlKey: false,
    });
    expect(onTabChange.mock.calls).toEqual([['manage-network'], ['manage-workflows']]);

    cleanup();
    const toggleRight = vi.fn();
    render(<RightFilters selectedRights={new Set()} onToggleRight={toggleRight} />);
    const filter = document.querySelector('[data-action-id="network.right-filter.toggle"]')!;
    fireEvent.click(filter);
    expect(toggleRight).toHaveBeenCalledWith(expect.any(String));
  });

  it('omits management tabs and panels when network management is unavailable', () => {
    render(
      <NetworkTabs
        activeTab="current-network"
        onTabChange={vi.fn()}
        currentNetworkContent={<div>current</div>}
        manageNetworkContent={<div>relationships</div>}
        manageWorkflowsContent={<div>workflows</div>}
        showManageNetworkTab={false}
        showManageWorkflowsTab={false}
      />
    );

    expect(document.querySelector('[data-action-id="network.tab.current.select"]')).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="network.tab.relationships.select"]')
    ).toBeNull();
    expect(document.querySelector('[data-action-id="network.tab.workflows.select"]')).toBeNull();
  });

  it('toggles control-panel filters, editability, sections, and legend', () => {
    const onPanelCollapsedChange = vi.fn();
    const onLegendCollapsedChange = vi.fn();
    const onInteractiveChange = vi.fn();
    const onFilter = vi.fn();
    render(
      <NetworkControlPanel
        title="Network"
        panelCollapsed
        onPanelCollapsedChange={onPanelCollapsedChange}
        legendCollapsed
        onLegendCollapsedChange={onLegendCollapsedChange}
        legendItems={[{ id: 'group', label: 'Group' }]}
        depthFilters={[{ id: 'direct', label: 'Direct', active: true, onToggle: onFilter }]}
        isInteractive
        onInteractiveChange={onInteractiveChange}
      />
    );

    fireEvent.click(document.querySelector('[data-action-id="network.control.panel.toggle"]')!);
    fireEvent.click(document.querySelector('[data-action-id="network.control.filter.toggle"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="network.control.interaction.toggle"]')!
    );
    fireEvent.click(document.querySelector('[data-action-id="network.control.legend.toggle"]')!);

    expect(onPanelCollapsedChange).toHaveBeenCalledWith(false);
    expect(onFilter).toHaveBeenCalledOnce();
    expect(onInteractiveChange).toHaveBeenCalledWith(false);
    expect(onLegendCollapsedChange).toHaveBeenCalledWith(false);
  });

  it('renders complete control-panel filters, legends, defaults, and optional content', () => {
    const showIndirect = vi.fn();
    const activeDefault = vi.fn();
    const inactiveDefault = vi.fn();
    const activeCustom = vi.fn();
    const inactiveCustom = vi.fn();
    const { rerender } = render(
      <NetworkControlPanel
        title="Network"
        description="Description"
        panelCollapsed
        onPanelCollapsedChange={vi.fn()}
        legendCollapsed
        onLegendCollapsedChange={vi.fn()}
        legendSections={[
          {
            id: 'first',
            title: 'First section',
            items: [
              { id: 'swatch', label: 'Swatch', swatch: <i>custom</i> },
              { id: 'class', label: 'Class', swatchClassName: 'swatch-class' },
              { id: 'plain', label: 'Plain' },
            ],
          },
          { id: 'second', items: [] },
        ]}
        showGroupTypeLegend
        showDisplayControls
        showInteractiveToggle={false}
        showIndirect
        onShowIndirectChange={showIndirect}
        isInteractive
        onInteractiveChange={vi.fn()}
        showRightsFilter
        selectedRights={new Set()}
        onToggleRight={vi.fn()}
        showRightsLegend
        showConnectionDirectionLegend
        relationshipStatusFiltersLabel="Statuses"
        relationshipStatusFilters={[
          { id: 'active-default', label: 'AD', active: true, onToggle: activeDefault },
          {
            id: 'inactive-default',
            label: 'ID',
            active: false,
            onToggle: inactiveDefault,
            disabled: true,
          },
          {
            id: 'active-custom',
            label: 'AC',
            active: true,
            onToggle: activeCustom,
            activeClassName: 'active-custom',
          },
          {
            id: 'inactive-custom',
            label: 'IC',
            active: false,
            onToggle: inactiveCustom,
            inactiveClassName: 'inactive-custom',
          },
        ]}
        connectionDirectionFilters={[]}
        controlsExtraContent={<span>Extra controls</span>}
        legendExtraContent={<span>Extra legend</span>}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="network.control.panel.toggle"]')!);
    const filters = document.querySelectorAll('[data-action-id="network.control.filter.toggle"]');
    fireEvent.click(filters[0]);
    fireEvent.click(filters[1]);
    fireEvent.click(filters[2]);
    fireEvent.click(filters[3]);
    fireEvent.click(filters[4]);
    fireEvent.click(filters[5]);
    expect(showIndirect.mock.calls).toEqual([[false], [true]]);
    expect(activeDefault).toHaveBeenCalledOnce();
    expect(inactiveDefault).not.toHaveBeenCalled();
    expect(activeCustom).toHaveBeenCalledOnce();
    expect(inactiveCustom).toHaveBeenCalledOnce();
    fireEvent.click(document.querySelector('[data-action-id="network.control.legend.toggle"]')!);
    expect(document.querySelector('.swatch-class')).toBeTruthy();

    state.translationEmpty = true;
    fireEvent.click(document.querySelector('[data-action-id="network.control.panel.toggle"]')!);
    fireEvent.click(document.querySelector('[data-action-id="network.control.panel.toggle"]')!);

    rerender(
      <NetworkControlPanel
        title="Network"
        panelCollapsed={false}
        onPanelCollapsedChange={vi.fn()}
        legendCollapsed={false}
        onLegendCollapsedChange={vi.fn()}
        legendItems={[{ id: 'default', label: 'Default' }]}
        showDisplayControls={false}
        showInteractiveToggle
        isInteractive={false}
        onInteractiveChange={vi.fn()}
        depthFilters={[]}
        filterRight="amendmentRight"
        relationshipStatusFilters={[]}
        controlsExtraContent={<span>Only extra controls</span>}
      />
    );
    expect(document.body.textContent).toBeTruthy();

    state.translationEmpty = false;
    fireEvent.click(document.querySelector('[data-action-id="network.control.panel.toggle"]')!);
    fireEvent.click(document.querySelector('[data-action-id="network.control.panel.toggle"]')!);

    rerender(
      <NetworkControlPanel
        title="Network"
        panelCollapsed
        onPanelCollapsedChange={vi.fn()}
        legendCollapsed
        onLegendCollapsedChange={vi.fn()}
        showDisplayControls={false}
        showInteractiveToggle={false}
        isInteractive
        onInteractiveChange={vi.fn()}
      />
    );
  });
});
