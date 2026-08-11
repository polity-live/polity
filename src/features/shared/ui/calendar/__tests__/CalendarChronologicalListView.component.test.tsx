// @vitest-environment jsdom

import * as React from 'react';

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  anchorKey: undefined as string | undefined,
  attachDay: true,
  attachMarker: true,
  attachViewport: true,
  contentProps: undefined as any,
  markerState: 'visible' as 'visible' | 'above' | 'below',
  markerViewport: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));

vi.mock('@/features/shared/logic/calendarListHelpers', () => ({
  getDateKey: (date: Date) => date.toISOString().slice(0, 10),
  getListAnchorDateKey: () => mocks.anchorKey,
  getMarkerInsertionIndex: (keys: string[]) => keys.length,
  getMarkerViewportState: (...args: unknown[]) => {
    mocks.markerViewport(...args);
    return mocks.markerState;
  },
}));

vi.mock('../CalendarChronologicalListContentView', () => ({
  CalendarChronologicalListContentView: (props: any) => {
    mocks.contentProps = props;
    return (
      <div ref={props.scrollAreaRef}>
        {mocks.attachViewport ? (
          <div data-radix-scroll-area-viewport="" data-testid="viewport" />
        ) : null}
        {mocks.attachMarker ? <div ref={props.todayMarkerRef} data-testid="marker" /> : null}
        {mocks.attachDay
          ? props.groupedEntries.map(([dateKey]: [string, unknown[]]) => (
              <div
                key={dateKey}
                data-testid={`day-${dateKey}`}
                ref={element => {
                  if (element) props.daySectionRefs.current.set(dateKey, element);
                  else props.daySectionRefs.current.delete(dateKey);
                }}
              />
            ))
          : null}
      </div>
    );
  },
}));

import { CalendarChronologicalListView } from '../CalendarChronologicalListView';

interface CalendarTestItem {
  date: number;
  id: string;
}

const itemDate = (item: CalendarTestItem) => item.date;
const itemKey = (item: CalendarTestItem) => item.id;

function view(overrides: Record<string, unknown> = {}) {
  return (
    <CalendarChronologicalListView
      items={[] as CalendarTestItem[]}
      selectedDate={new Date('2025-01-02T12:00:00Z')}
      getItemDate={itemDate}
      getItemKey={itemKey}
      renderItem={item => <span>{item.id}</span>}
      emptyText="Empty"
      {...overrides}
    />
  );
}

describe('CalendarChronologicalListView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-02T12:00:00Z'));
    vi.clearAllMocks();
    mocks.anchorKey = undefined;
    mocks.attachDay = true;
    mocks.attachMarker = true;
    mocks.attachViewport = true;
    mocks.markerState = 'visible';
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('sorts and groups items by date and forwards default view props', () => {
    const items = [
      { date: new Date('2025-01-03').getTime(), id: 'third' },
      { date: new Date('2025-01-01T18:00:00Z').getTime(), id: 'second' },
      { date: new Date('2025-01-01T08:00:00Z').getTime(), id: 'first' },
    ];
    render(view({ items }));

    expect(mocks.contentProps.groupedEntries.map(([key]: [string]) => key)).toEqual([
      '2025-01-01',
      '2025-01-03',
    ]);
    expect(mocks.contentProps.groupedEntries[0][1].map((item: { id: string }) => item.id)).toEqual([
      'first',
      'second',
    ]);
    expect(mocks.contentProps.itemMotion).toBe('none');
    expect(mocks.contentProps.language).toBe('en');
    expect(mocks.contentProps.todayMarkerIndex).toBe(2);
  });

  it('scrolls directly to today and keeps an unchanged marker state', () => {
    render(view({ items: [{ date: Date.now(), id: 'today' }], itemMotion: 'place' }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(mocks.contentProps.todayMarkerState).toBe('visible');
    expect(mocks.markerViewport).toHaveBeenCalled();

    act(() => mocks.contentProps.scrollToTodayMarker());
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
  });

  it('uses a day anchor for non-today dates and updates marker state', () => {
    mocks.anchorKey = '2025-01-03';
    mocks.markerState = 'above';
    render(
      view({
        items: [{ date: new Date('2025-01-03').getTime(), id: 'future' }],
        selectedDate: new Date('2025-01-03'),
      })
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(mocks.contentProps.todayMarkerState).toBe('above');

    mocks.markerState = 'below';
    fireEvent.scroll(document.querySelector('[data-testid="viewport"]')!);
    expect(mocks.contentProps.todayMarkerState).toBe('below');
    fireEvent.resize(window);
    expect(mocks.markerViewport).toHaveBeenCalled();
  });

  it('does not scroll when no list anchor exists', () => {
    render(
      view({
        items: [{ date: new Date('2025-01-03').getTime(), id: 'future' }],
        selectedDate: new Date('2025-01-04'),
      })
    );
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('handles a named anchor with no mounted day section', () => {
    mocks.anchorKey = '2025-01-03';
    mocks.attachDay = false;
    render(
      view({
        items: [{ date: new Date('2025-01-03').getTime(), id: 'future' }],
        selectedDate: new Date('2025-01-03'),
      })
    );
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('returns safely when viewport or marker refs are unavailable', () => {
    mocks.attachViewport = false;
    const noViewport = render(view());
    act(() => mocks.contentProps.scrollToTodayMarker());
    expect(mocks.markerViewport).not.toHaveBeenCalled();
    noViewport.unmount();

    mocks.attachViewport = true;
    mocks.attachMarker = false;
    render(view());
    act(() => mocks.contentProps.scrollToTodayMarker());
    expect(mocks.markerViewport).not.toHaveBeenCalled();
  });
});
