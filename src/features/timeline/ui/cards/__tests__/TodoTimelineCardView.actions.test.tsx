/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  actionButtonProps: undefined as Record<string, any> | undefined,
  shareProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme-${key}`,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div data-testid="progress" data-value={value} className={className} />
  ),
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, any>) => {
    mocks.shareProps = props;
    return <button type="button">Share</button>;
  },
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardHeader: ({ children, title, subtitle }: any) => (
    <header>
      {title}
      {subtitle ? `:${subtitle}` : ''}
      {children}
    </header>
  ),
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
  TimelineCardActionButton: (props: Record<string, any>) => {
    mocks.actionButtonProps = props;
    return (
      <button
        type="button"
        data-action-id={props['data-action-id']}
        onClick={props.onClick}
        disabled={props.disabled}
      >
        {props.label}
      </button>
    );
  },
}));

import { TodoTimelineCardView } from '../TodoTimelineCardView';

const statusLabels = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const labels = {
  contentType: 'Todo',
  completed: 'Completed',
  markComplete: 'Mark complete',
  archived: 'Archived',
  progress: 'Progress',
  assigned: 'assigned',
  assignedToMe: 'Assigned to me',
  assignToMe: 'Assign to me',
};

function props(overrides: Record<string, any> = {}) {
  return {
    todo: { id: 'todo-1', title: 'Task', isCompleted: false },
    className: undefined,
    canManageTodos: false,
    showStatusAction: false,
    detailHref: undefined,
    onCardClick: undefined,
    onToggle: undefined,
    urgency: null,
    progress: undefined,
    assignmentsCount: 0,
    isAssignedToMe: false,
    currentStatus: 'pending',
    statusLabels,
    statusOpen: false,
    onStatusOpenChange: vi.fn(),
    onStatusUpdate: vi.fn().mockResolvedValue(undefined),
    isStatusUpdating: false,
    assigning: false,
    onAssignToMe: vi.fn().mockResolvedValue(undefined),
    labels,
    ...overrides,
  };
}

function action(container: HTMLElement, id: string) {
  const element = container.querySelector(`[data-action-id="${id}"]`);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}

beforeEach(() => {
  mocks.baseProps = undefined;
  mocks.actionButtonProps = undefined;
  mocks.shareProps = undefined;
});

afterEach(cleanup);

describe('TodoTimelineCardView', () => {
  it('renders a minimal view-only card and share fallbacks', () => {
    const { container } = render(<TodoTimelineCardView {...(props() as any)} />);
    expect(mocks.baseProps).toMatchObject({ href: undefined, onClick: undefined });
    expect(
      container.querySelector('[data-action-id="timeline.todo.completion.toggle"]')
    ).toBeNull();
    expect(container.querySelector('[data-action-id="timeline.todo.status.menu.open"]')).toBeNull();
    expect(container.querySelector('[data-action-id="timeline.todo.assignment.claim"]')).toBeNull();
    expect(mocks.shareProps).toMatchObject({ url: '/todos/todo-1', description: '' });
  });

  it('renders and dispatches every active management action', () => {
    const onToggle = vi.fn();
    const onAssignToMe = vi.fn().mockResolvedValue(undefined);
    const onStatusUpdate = vi.fn().mockResolvedValue(undefined);
    const viewProps = props({
      todo: {
        id: 'todo-1',
        title: 'Task',
        description: 'Description',
        isCompleted: false,
        groupId: 'group-1',
        groupName: 'Group',
        currentValue: 2,
        targetValue: 4,
        unit: 'items',
        assigneeCount: 0,
      },
      className: 'custom',
      canManageTodos: true,
      showStatusAction: true,
      detailHref: '/todos/todo-1',
      onCardClick: vi.fn(),
      onToggle,
      urgency: { label: 'Soon', bgColor: 'soon-bg', color: 'soon-text' },
      progress: 50,
      assignmentsCount: 3,
      onAssignToMe,
      onStatusUpdate,
    });
    const { container } = render(<TodoTimelineCardView {...(viewProps as any)} />);
    expect(mocks.baseProps).toMatchObject({ href: '/todos/todo-1', className: 'custom' });
    expect(container.textContent).toContain('2 / 4 items');
    expect(container.textContent).toContain('Soon');
    expect(container.textContent).toContain('0 assigned');
    fireEvent.click(action(container, 'timeline.todo.completion.toggle'));
    expect(onToggle).toHaveBeenCalledOnce();

    const statusButtons = container.querySelectorAll(
      '[data-action-id="timeline.todo.status.select"]'
    );
    expect(statusButtons).toHaveLength(3);
    fireEvent.click(statusButtons[0]!);
    expect(onStatusUpdate).toHaveBeenCalledWith('in_progress');
    fireEvent.click(action(container, 'timeline.todo.assignment.claim'));
    expect(onAssignToMe).toHaveBeenCalledOnce();
    expect(mocks.shareProps?.description).toBe('Description');
  });

  it('renders completed percent progress without urgency and disables assigned action', () => {
    const { container } = render(
      <TodoTimelineCardView
        {...(props({
          todo: {
            id: 'todo-2',
            title: 'Done',
            description: 'Completed description',
            isCompleted: true,
            currentValue: 1,
            targetValue: 1,
          },
          canManageTodos: true,
          progress: 100,
          urgency: { label: 'Overdue', bgColor: 'danger', color: 'danger' },
          assignmentsCount: 2,
          isAssignedToMe: true,
          assigning: true,
        }) as any)}
      />
    );
    expect(container.textContent).toContain('1 / 1');
    expect(container.textContent).not.toContain('Overdue');
    expect(action(container, 'timeline.todo.assignment.claim').hasAttribute('disabled')).toBe(true);
    expect(mocks.actionButtonProps).toMatchObject({
      variant: 'secondary',
      label: 'Assigned to me',
    });
  });

  it('uses percent-only progress when current and target values are absent', () => {
    const { container } = render(<TodoTimelineCardView {...(props({ progress: 25 }) as any)} />);
    expect(container.textContent).toContain('25%');
  });

  it('renders archived state and suppresses all management controls', () => {
    const { container } = render(
      <TodoTimelineCardView
        {...(props({
          todo: { id: 'todo-3', title: 'Archived task', isCompleted: true, archived: true },
          canManageTodos: true,
          showStatusAction: true,
        }) as any)}
      />
    );
    expect(container.textContent).toContain('Archived');
    expect(
      container.querySelector('[data-action-id="timeline.todo.completion.toggle"]')
    ).toBeNull();
    expect(container.querySelector('[data-action-id="timeline.todo.status.menu.open"]')).toBeNull();
    expect(container.querySelector('[data-action-id="timeline.todo.assignment.claim"]')).toBeNull();
  });

  it('uses assignment fallback counts and supports absent toggle callbacks', () => {
    const { container } = render(
      <TodoTimelineCardView
        {...(props({
          todo: { id: 'todo-4', title: 'Fallback', isCompleted: false },
          canManageTodos: true,
          assignmentsCount: 4,
          onToggle: undefined,
        }) as any)}
      />
    );
    expect(container.textContent).toContain('4 assigned');
    fireEvent.click(action(container, 'timeline.todo.completion.toggle'));
  });

  it('omits assignment stats for zero fallback and status actions when explicitly hidden', () => {
    const { container } = render(
      <TodoTimelineCardView
        {...(props({
          todo: { id: 'todo-5', title: 'No stats', isCompleted: false },
          canManageTodos: true,
          showStatusAction: false,
          assignmentsCount: 0,
        }) as any)}
      />
    );
    expect(container.textContent).not.toContain('assigned');
    expect(container.querySelector('[data-action-id="timeline.todo.status.menu.open"]')).toBeNull();
  });
});
