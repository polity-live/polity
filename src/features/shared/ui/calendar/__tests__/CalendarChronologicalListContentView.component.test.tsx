// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  anchor: undefined as string | undefined,
  config: undefined as any,
  measure: vi.fn(),
  scrollToIndex: vi.fn(),
  virtualItems: [] as { index: number; start: number }[],
}));

vi.mock('@/features/shared/logic/calendarListHelpers', () => ({
  getListAnchorDateKey: () => mocks.anchor,
}));

vi.mock('@/features/shared/virtualization', () => ({
  usePolityLocalVirtualizer: (config: unknown) => {
    mocks.config = config;
    return {
      getTotalSize: () => 640,
      getVirtualItems: () => mocks.virtualItems,
      measureElement: mocks.measure,
      scrollToIndex: mocks.scrollToIndex,
    };
  },
}));

vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: React.PropsWithChildren) => <section>{children}</section>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/features/shared/ui/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    function MockScrollArea({ children, ...props }, ref) {
      return (
        <div ref={ref} {...props}>
          <div data-radix-scroll-area-viewport="">{children}</div>
        </div>
      );
    }
  ),
}));

vi.mock('lucide-react', () => ({
  ArrowDown: () => <i data-testid="down" />,
  ArrowUp: () => <i data-testid="up" />,
  Calendar: () => <i data-testid="calendar" />,
}));

import { CalendarChronologicalListContentView } from '../CalendarChronologicalListContentView';

function props(overrides: Record<string, unknown> = {}) {
  return {
    daySectionRefs: { current: new Map<string, HTMLDivElement>() },
    emptyText: 'No entries',
    getItemKey: (item: { id: string }) => item.id,
    groupedEntries: [],
    itemMotion: 'none' as const,
    items: [],
    language: 'en',
    renderItem: (item: { id: string }) => <span>{item.id}</span>,
    selectedDate: new Date('2025-01-02T00:00:00'),
    scrollAreaRef: React.createRef<HTMLDivElement>(),
    scrollToTodayMarker: vi.fn(),
    t: (key: string) => (key === 'features.calendar.today' ? 'Today' : key),
    todayDateKey: '2025-01-02',
    todayMarkerIndex: 0,
    todayMarkerRef: React.createRef<HTMLDivElement>(),
    todayMarkerState: 'visible' as const,
    ...overrides,
  };
}

describe('CalendarChronologicalListContentView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.anchor = undefined;
    mocks.virtualItems = [];
  });
  afterEach(cleanup);

  it('renders an empty card and handles an absent scroll element and anchor', () => {
    const input = props();
    render(<CalendarChronologicalListContentView {...input} />);

    expect(screen.getByText('No entries')).toBeTruthy();
    expect(screen.getByTestId('calendar')).toBeTruthy();
    expect(mocks.config.count).toBe(1);
    expect(mocks.config.estimateSize()).toBe(320);
    expect(mocks.config.getScrollElement()).toBeUndefined();
    expect(mocks.scrollToIndex).not.toHaveBeenCalled();
  });

  it('scrolls to a valid date anchor and ignores an unknown anchor', () => {
    mocks.anchor = '2025-01-02';
    mocks.virtualItems = [{ index: 0, start: 0 }];
    const input = props({
      groupedEntries: [['2025-01-02', [{ id: 'one' }]]],
      items: [{ id: 'one' }],
    });
    const view = render(<CalendarChronologicalListContentView {...input} />);
    expect(mocks.scrollToIndex).toHaveBeenCalledWith(0, { align: 'start' });
    expect(mocks.config.getScrollElement().hasAttribute('data-radix-scroll-area-viewport')).toBe(
      true
    );

    mocks.anchor = 'missing';
    view.rerender(
      <CalendarChronologicalListContentView {...input} selectedDate={new Date('2025-01-03')} />
    );
    expect(mocks.scrollToIndex).toHaveBeenCalledTimes(1);
  });

  it('renders above and below marker controls and invokes scrolling', () => {
    mocks.virtualItems = [{ index: 0, start: 0 }];
    const scrollToTodayMarker = vi.fn();
    const input = props({
      groupedEntries: [['2025-01-01', [{ id: 'one' }]]],
      items: [{ id: 'one' }],
      scrollToTodayMarker,
      todayMarkerIndex: 2,
      todayMarkerState: 'above',
    });
    const view = render(<CalendarChronologicalListContentView {...input} />);
    expect(screen.getByTestId('up')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(scrollToTodayMarker).toHaveBeenCalledOnce();

    view.rerender(<CalendarChronologicalListContentView {...input} todayMarkerState="below" />);
    expect(screen.getByTestId('down')).toBeTruthy();
  });

  it('renders marker tails and both marker visual states', () => {
    mocks.virtualItems = [{ index: 1, start: 300 }];
    const input = props({
      groupedEntries: [['2025-01-01', [{ id: 'one' }]]],
      items: [{ id: 'one' }],
      todayMarkerIndex: 1,
      todayMarkerState: 'below',
    });
    const view = render(<CalendarChronologicalListContentView {...input} />);
    expect(screen.getAllByText('Today').find(node => node.tagName === 'SPAN')?.className).toContain(
      'text-muted-foreground'
    );

    view.rerender(<CalendarChronologicalListContentView {...input} todayMarkerState="visible" />);
    expect(screen.getAllByText('Today').find(node => node.tagName === 'SPAN')?.className).toContain(
      'text-primary'
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders today and ordinary sections, contact details, and cleans ref maps', () => {
    mocks.virtualItems = [
      { index: 0, start: 0 },
      { index: 1, start: 320 },
    ];
    const daySectionRefs = { current: new Map<string, HTMLDivElement>() };
    const input = props({
      daySectionRefs,
      groupedEntries: [
        ['2025-01-02', [{ id: 'today-item' }]],
        ['2025-01-03', [{ id: 'other-item' }]],
      ],
      items: [{ id: 'today-item' }, { id: 'other-item' }],
      language: 'de',
      todayMarkerIndex: 0,
    });
    const view = render(<CalendarChronologicalListContentView {...input} />);

    expect(screen.getByText('today-item')).toBeTruthy();
    expect(screen.getByText('other-item')).toBeTruthy();
    expect(screen.getAllByText(/Today/).length).toBeGreaterThan(0);
    expect(daySectionRefs.current.has('2025-01-02')).toBe(true);
    expect(daySectionRefs.current.has('2025-01-03')).toBe(true);

    view.unmount();
    expect(daySectionRefs.current.size).toBe(0);
  });

  it('applies placement motion and caps its stagger index', () => {
    const dayItems = Array.from({ length: 13 }, (_, index) => ({ id: `item-${index}` }));
    mocks.virtualItems = [{ index: 0, start: 10 }];
    const { container } = render(
      <CalendarChronologicalListContentView
        {...props({
          groupedEntries: [['2025-01-03', dayItems]],
          itemMotion: 'place',
          items: dayItems,
          language: 'en',
          todayMarkerIndex: 5,
        })}
      />
    );

    const placed = container.querySelectorAll('.civic-load-card-place');
    expect(placed).toHaveLength(13);
    expect((placed[0] as HTMLElement).style.getPropertyValue('--civic-load-index')).toBe('0');
    expect((placed[12] as HTMLElement).style.getPropertyValue('--civic-load-index')).toBe('11');
  });
});
