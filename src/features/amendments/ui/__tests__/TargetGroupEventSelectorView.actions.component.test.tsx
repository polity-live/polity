/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TargetGroupEventSelectorView,
  type TargetGroupEventSelectorViewProps,
} from '../TargetGroupEventSelectorView';

const mocks = vi.hoisted(() => ({
  selectChange: undefined as undefined | ((value: string) => void),
  pathModeChange: undefined as undefined | ((value: string) => void),
  language: 'en',
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
  FormControlSelect: ({
    children,
    onValueChange,
    ...props
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => {
    mocks.selectChange = onValueChange;
    return <div {...props}>{children}</div>;
  },
  FormControlSelectTrigger: ({ children, ...props }: ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  FormControlSelectValue: () => <span>path</span>,
  FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormControlSelectItem: ({
    children,
    value,
    ...props
  }: ComponentProps<'button'> & { value: string }) => (
    <button type="button" {...props} onClick={() => mocks.selectChange?.(value)}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => <div data-tab-change={String(Boolean(onValueChange))}>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value, ...props }: ComponentProps<'button'> & { value: string }) => (
    <button type="button" {...props} onClick={() => mocks.pathModeChange?.(value)}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: () => <div data-testid="typeahead" />,
}));
vi.mock('@/features/network/ui/UserNetworkFlow', () => ({ UserNetworkFlow: () => <div /> }));
vi.mock('@/features/network/ui/GroupNetworkFlow', () => ({ GroupNetworkFlow: () => <div /> }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ language: mocks.language, t: (key: string) => key }),
}));

function createProps(
  overrides: Partial<TargetGroupEventSelectorViewProps> = {}
): TargetGroupEventSelectorViewProps {
  const source = { id: 'source-1', name: 'Source', description: null } as never;
  const target = { id: 'target-1', name: 'Target', description: null } as never;
  return {
    activeSourceGroups: [source],
    allWorkflows: [{ id: 'workflow-1', name: 'Workflow' }],
    availableHierarchyPaths: [
      { id: 'path-1', groupIds: ['source-1', 'target-1'] },
      { id: 'path-2', groupIds: ['source-1', 'middle-1', 'target-1'] },
    ],
    availableTargetGroups: [target],
    collaborators: [],
    disablePortal: true,
    getUpcomingEventsForGroup: () => [],
    handleSourceGroupSelection: vi.fn(),
    handleStartGraphGroupClick: vi.fn(),
    handleTargetGraphGroupClick: vi.fn(),
    layoutScope: 'test',
    networkGroups: [source, target],
    onHierarchyPathValueChange: vi.fn(),
    onPathModeValueChange: vi.fn(),
    onPathSegmentEventChange: vi.fn(),
    onSelectedUserChange: vi.fn(),
    onTargetEventChange: vi.fn(),
    onTargetGroupChange: vi.fn(),
    onWorkflowItemChange: vi.fn(),
    pathMode: 'hierarchy',
    pathValidationError: null,
    pathWithEvents: [],
    reachableWorkflows: [],
    selectedGroup: { id: 'target-1', data: target },
    selectedHierarchyPathId: 'path-1',
    selectedEvent: null,
    selectedSourceGroup: { id: 'source-1', data: source },
    selectedUserId: '',
    selectedWorkflowFinalGroup: null,
    selectedWorkflow: null,
    selectedWorkflowIdState: '',
    selectedWorkflowStartGroup: null,
    targetEventItems: [],
    targetPathSegment: null,
    upcomingEvents: [],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  mocks.selectChange = undefined;
  mocks.pathModeChange = undefined;
  mocks.language = 'en';
});

describe('TargetGroupEventSelectorView actions', () => {
  it('switches path modes and hierarchy alternatives through stable actions', () => {
    const props = createProps();
    mocks.pathModeChange = props.onPathModeValueChange;
    const { container } = render(<TargetGroupEventSelectorView {...props} />);

    fireEvent.click(
      container.querySelector('[data-action-id="amendments.target-path.select.hierarchy"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="amendments.target-path.select.workflow"]')!
    );
    expect(props.onPathModeValueChange).toHaveBeenNthCalledWith(1, 'hierarchy');
    expect(props.onPathModeValueChange).toHaveBeenNthCalledWith(2, 'workflow');

    const pathOptions = container.querySelectorAll(
      '[data-action-id="amendments.target-path.select.hierarchy-path-option"]'
    );
    fireEvent.click(pathOptions[1]);
    expect(props.onHierarchyPathValueChange).toHaveBeenCalledWith('path-2');
    expect(
      container.querySelector('[data-action-id="amendments.target-path.select.hierarchy-path"]')
    ).toBeTruthy();
  });

  it('renders empty source, target, workflow, collaborator, and user-network fallbacks', () => {
    const { container } = render(
      <TargetGroupEventSelectorView
        {...createProps({
          activeSourceGroups: [],
          allWorkflows: [],
          availableTargetGroups: [],
          collaborators: [
            { id: 'named', name: 'Named', email: 'named@example.com' },
            { id: 'fallback', name: '', email: null },
          ],
          layoutScope: 'amendment-process-start',
          selectedGroup: null,
          selectedSourceGroup: null,
        })}
      />
    );
    expect(container.textContent).toContain(
      'generated.inline.0179_keine_aktive_mitgliedschaft_mit_moeglichem_am_3dc842fc'
    );
    expect(container.textContent).toContain(
      'generated.inline.0184_fuer_diese_startgruppe_gibt_es_keine_rekursiv_5eba3922'
    );
  });

  it('renders every locked workflow and target label fallback', () => {
    const base = createProps({
      lockTargetSelection: true,
      pathMode: 'workflow',
      selectedWorkflow: { id: 'workflow', name: 'Named workflow' },
    });
    const { container, rerender } = render(<TargetGroupEventSelectorView {...base} />);
    expect(container.textContent).toContain('Named workflow');

    rerender(
      <TargetGroupEventSelectorView
        {...base}
        selectedWorkflow={{ id: 'workflow', name: null }}
        selectedWorkflowFinalGroup={{ id: 'final', name: 'Final group' } as any}
      />
    );
    expect(container.textContent).toContain('Final group');

    rerender(
      <TargetGroupEventSelectorView
        {...base}
        selectedWorkflow={null}
        selectedWorkflowFinalGroup={null}
      />
    );
    expect(container.textContent).toContain('generated.inline.0028_unbekannt_d0b00a9f');

    rerender(
      <TargetGroupEventSelectorView
        {...base}
        pathMode="hierarchy"
        selectedGroup={{ id: 'target', data: { id: 'target', name: 'Direct target' } as any }}
      />
    );
    expect(container.textContent).toContain('Direct target');

    rerender(
      <TargetGroupEventSelectorView
        {...base}
        pathMode="hierarchy"
        selectedGroup={null}
        selectedWorkflowFinalGroup={{ id: 'derived', name: 'Derived target' } as any}
      />
    );
    expect(container.textContent).toContain('Derived target');
  });

  it('covers hierarchy short circuits, workflow details, localized groups, and path events', () => {
    mocks.language = 'de';
    const source = {
      id: 'source',
      name: 'Quelle',
      description: 'Eine ausführliche Beschreibung',
      tutorial_run_id: 'tutorial',
    } as any;
    const unnamed = {
      id: 'unnamed',
      name: null,
      description: null,
      tutorial_run_id: null,
    } as any;
    const event = { id: 'event', title: '', start_date: null };
    const base = createProps({
      activeSourceGroups: [source, unnamed],
      networkGroups: [source, unnamed],
      availableTargetGroups: [unnamed],
      availableHierarchyPaths: [
        { id: 'one', groupIds: ['source', 'unnamed', 'missing'] },
        { id: 'two', groupIds: ['source', 'missing'] },
      ],
      selectedSourceGroup: { id: 'source', data: source },
      selectedGroup: null,
      selectedWorkflowIdState: 'workflow',
      selectedWorkflowStartGroup: null,
      selectedWorkflowFinalGroup: { id: 'final', name: 'Final' } as any,
      reachableWorkflows: [
        { id: 'one', name: '', group: { name: 'Owner' }, group_id: 'owner' },
        { id: 'two', name: 'Named', group: null, group_id: null },
      ],
      upcomingEvents: [event],
      targetEventItems: [{ id: 'event', label: 'Event', type: 'event' } as any],
      targetPathSegment: { segmentKey: 'target' } as any,
      getUpcomingEventsForGroup: vi.fn(() => [event]),
      pathValidationError: 'Invalid path',
      pathWithEvents: [
        {
          segmentKey: 'target',
          groupId: 'source',
          groupName: 'Quelle',
          stepLabel: 'Step label',
          requiredAfter: 1_786_000_000_000,
          requiredBefore: null,
          eventId: 'event',
        },
        {
          segmentKey: 'other',
          groupId: 'missing',
          groupName: 'Missing',
          stepLabel: null,
          requiredAfter: null,
          requiredBefore: 1_786_100_000_000,
          eventId: null,
        },
      ] as any,
    });
    const { container, rerender } = render(<TargetGroupEventSelectorView {...base} />);
    expect(container.textContent).toContain('Step label');
    expect(container.textContent).toContain('Invalid path');
    expect(base.getUpcomingEventsForGroup).toHaveBeenCalledWith(
      'missing',
      expect.objectContaining({ segmentKey: 'other' })
    );

    rerender(
      <TargetGroupEventSelectorView
        {...base}
        selectedGroup={{ id: 'unnamed', data: unnamed }}
        availableHierarchyPaths={[base.availableHierarchyPaths[0]]}
      />
    );
    expect(container.textContent).toContain('Final');

    rerender(
      <TargetGroupEventSelectorView
        {...base}
        selectedSourceGroup={null}
        selectedGroup={{ id: 'unnamed', data: unnamed }}
      />
    );
    expect(container.textContent).toBeTruthy();

    rerender(
      <TargetGroupEventSelectorView
        {...base}
        layoutScope="amendment-process-start"
        selectedSourceGroup={{ id: 'unnamed', data: unnamed }}
        selectedWorkflowFinalGroup={null}
      />
    );
    expect(container.textContent).toContain('generated.inline.0028_unbekannt_d0b00a9f');
  });
});
