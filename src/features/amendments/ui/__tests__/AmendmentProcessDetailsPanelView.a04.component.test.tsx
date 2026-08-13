/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathProps: null as any, forwardingProps: null as any }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, onClick, params }: any) => (
    <a href={`#${params?.id ?? ''}`} onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/amendments/ui/AmendmentForwardingPreview', () => ({
  AmendmentForwardingPreview: (props: any) => {
    mocks.forwardingProps = props;
    return <div>forwarding preview</div>;
  },
}));
vi.mock('@/features/network/ui/AmendmentPathVisualization', () => ({
  AmendmentPathVisualization: (props: any) => {
    mocks.pathProps = props;
    return <div>path visualization</div>;
  },
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  EditingModeBadge: ({ mode }: { mode: string }) => <span>mode:{mode}</span>,
}));
vi.mock('@/features/shared/ui/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

import { AmendmentProcessDetailsPanelView } from '../AmendmentProcessDetailsPanelView';

const labels = {
  amendmentDetails: 'Details',
  viewAmendment: 'View',
  title: 'Title',
  reason: 'Reason',
  preamble: 'Preamble',
  pathVisualization: 'Path',
};

describe('AmendmentProcessDetailsPanelView A04 branch accountability', () => {
  afterEach(() => {
    cleanup();
    mocks.pathProps = null;
    mocks.forwardingProps = null;
  });

  it('renders a populated default panel from the first process branch', () => {
    const groupTypes = new Map([['group', 'city']]);
    const stop = vi.spyOn(Event.prototype, 'stopPropagation');
    render(
      <AmendmentProcessDetailsPanelView
        amendment={{
          id: 'amendment',
          title: 'Amendment title',
          reason: 'Reason text',
          preamble: 'Preamble text',
          editing_mode: 'edit',
          current_process_run: {
            branches: [
              { id: 'later', created_at: 2, editing_mode: 'view' },
              { id: 'first', created_at: 1, editing_mode: 'suggest_internal' },
            ],
          },
          group: { id: 'group', name: 'Group name' },
        }}
        forwardingPreview={
          {
            status: 'forwarded',
            nextEventId: 'event',
            nextGroupId: 'next-group',
            nextGroupName: 'Next group',
            nextEventTitle: 'Next event',
            nextEventStartDate: '2026-08-20',
          } as any
        }
        pathVisualizationData={[{ groupId: 'group' }] as any}
        groupTypeById={groupTypes}
        onGroupClick={vi.fn()}
        onEventClick={vi.fn()}
        open
        onOpenChange={vi.fn()}
        labels={labels}
      />
    );

    expect(screen.getByText('mode:suggest_internal')).toBeTruthy();
    expect(screen.getByText('Amendment title')).toBeTruthy();
    expect(screen.getByText('Reason text')).toBeTruthy();
    expect(screen.getByText('Group name')).toBeTruthy();
    expect(screen.getByText('Next group')).toBeTruthy();
    expect(screen.getByText('path visualization')).toBeTruthy();
    expect(mocks.pathProps.groupTypeById).toBe(groupTypes);
    expect(mocks.forwardingProps.compact).toBe(true);
    fireEvent.click(screen.getByText('View'));
    expect(stop).toHaveBeenCalled();
    stop.mockRestore();
  });

  it('falls back to amendment editing mode and renders a group name without an id', () => {
    render(
      <AmendmentProcessDetailsPanelView
        amendment={{
          id: 'amendment',
          title: null,
          reason: null,
          preamble: null,
          editing_mode: 'edit',
          current_process_run: { branches: null },
          group: { name: 'Unlinked group' } as any,
        }}
        forwardingPreview={
          {
            status: 'pending',
            nextEventId: null,
            nextGroupId: null,
            nextGroupName: null,
          } as any
        }
        pathVisualizationData={[]}
        open={false}
        onOpenChange={vi.fn()}
        labels={labels}
      />
    );

    expect(screen.getByText('mode:edit')).toBeTruthy();
    expect(screen.getByText('Unlinked group')).toBeTruthy();
    expect(screen.getByText('forwarding preview')).toBeTruthy();
    expect(screen.queryByText('path visualization')).toBeNull();
  });

  it('renders all empty defaults and supplies a map when path group types are absent', () => {
    const { rerender } = render(
      <AmendmentProcessDetailsPanelView
        amendment={{
          id: 'empty',
          editing_mode: null,
          current_process_run: undefined,
          group: { id: 'id-only', name: null },
        }}
        open={false}
        onOpenChange={vi.fn()}
        labels={labels}
      />
    );
    expect(screen.queryByText(/mode:/)).toBeNull();
    expect(screen.queryByText('forwarding preview')).toBeNull();

    rerender(
      <AmendmentProcessDetailsPanelView
        amendment={{ id: 'path', group: null }}
        pathVisualizationData={[{ groupId: 'group' }] as any}
        open
        onOpenChange={vi.fn()}
        labels={labels}
      />
    );
    expect(mocks.pathProps.groupTypeById).toBeInstanceOf(Map);
  });
});
