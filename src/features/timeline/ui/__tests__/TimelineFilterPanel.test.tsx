/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sheet', () => ({
  Sheet: ({ children, onOpenChange }: any) => (
    <div>
      <button type="button" data-testid="sheet-open" onClick={() => onOpenChange(true)}>
        Open
      </button>
      <button type="button" data-testid="sheet-close" onClick={() => onOpenChange(false)}>
        Close sheet
      </button>
      {children}
    </div>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableSheetContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlCheckbox: ({ onCheckedChange, ...props }: any) => (
    <input type="checkbox" onChange={onCheckedChange} {...props} />
  ),
  FormControlLabel: ({ children, htmlFor, ...props }: any) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
}));
vi.mock('@/features/shared/ui/filter-controls', () => ({
  FilterButton: ({ children, active, ...props }: any) => (
    <button type="button" data-active={active} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/separator', () => ({ Separator: () => <hr /> }));

import { TimelineFilterPanel } from '../TimelineFilterPanel';

function props(overrides: Record<string, any> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    contentTypes: ['event'],
    onContentTypesChange: vi.fn(),
    onContentTypeToggle: vi.fn(),
    dateRange: 'today',
    onDateRangeChange: vi.fn(),
    topics: ['climate'],
    availableTopics: ['climate', 'housing'],
    onTopicToggle: vi.fn(),
    engagement: 'popular',
    onEngagementChange: vi.fn(),
    onResetFilters: vi.fn(),
    hasActiveFilters: true,
    contentTypeOptions: ['event', 'blog'],
    radiusKm: 25,
    onRadiusChange: vi.fn(),
    showEngagement: true,
    ...overrides,
  };
}

function action(container: HTMLElement, id: string, index = 0) {
  const elements = container.querySelectorAll(`[data-action-id="${id}"]`);
  if (!elements[index]) throw new Error(`Missing ${id}[${index}]`);
  return elements[index];
}

afterEach(cleanup);

describe('TimelineFilterPanel', () => {
  it('renders selected and unselected choices and dispatches every control', () => {
    const viewProps = props();
    const { container } = render(<TimelineFilterPanel {...(viewProps as any)} />);
    fireEvent.click(container.querySelector('[data-testid="sheet-open"]')!);
    expect(viewProps.onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('[data-testid="sheet-close"]')!);
    fireEvent.click(action(container, 'timeline.filters.reset'));
    fireEvent.click(action(container, 'timeline.filters.content.select-all'));
    fireEvent.click(action(container, 'timeline.filters.content.select-none'));
    fireEvent.click(action(container, 'timeline.filters.content.toggle', 0));
    fireEvent.click(action(container, 'timeline.filters.radius.select', 1));
    fireEvent.click(action(container, 'timeline.filters.date-range.select', 2));
    fireEvent.click(action(container, 'timeline.filters.engagement.select', 2));
    fireEvent.click(action(container, 'timeline.filters.topic.toggle', 0));
    fireEvent.click(action(container, 'timeline.filters.topic.toggle', 1));
    fireEvent.click(action(container, 'timeline.filters.close'));
    expect(viewProps.onClose).toHaveBeenCalledTimes(2);
    expect(viewProps.onResetFilters).toHaveBeenCalledOnce();
    expect(viewProps.onContentTypesChange).toHaveBeenNthCalledWith(1, ['event', 'blog']);
    expect(viewProps.onContentTypesChange).toHaveBeenNthCalledWith(2, []);
    expect(viewProps.onContentTypeToggle).toHaveBeenCalledWith('event');
    expect(viewProps.onRadiusChange).toHaveBeenCalledWith(10);
    expect(viewProps.onDateRangeChange).toHaveBeenCalledWith('week');
    expect(viewProps.onEngagementChange).toHaveBeenCalledWith('rising');
    expect(viewProps.onTopicToggle).toHaveBeenCalledWith('climate');
    expect(viewProps.onTopicToggle).toHaveBeenCalledWith('housing');
    expect(action(container, 'timeline.filters.topic.toggle', 0).querySelector('svg')).toBeTruthy();
    expect(action(container, 'timeline.filters.topic.toggle', 1).querySelector('svg')).toBeNull();
  });

  it('uses lean defaults and omits optional filter groups', () => {
    const { container } = render(
      <TimelineFilterPanel
        {...(props({
          availableTopics: undefined,
          radiusKm: undefined,
          onRadiusChange: undefined,
          showEngagement: false,
          hasActiveFilters: false,
        }) as any)}
      />
    );
    expect(container.querySelector('[data-action-id="timeline.filters.reset"]')).toBeNull();
    expect(container.querySelector('[data-action-id="timeline.filters.radius.select"]')).toBeNull();
    expect(
      container.querySelector('[data-action-id="timeline.filters.engagement.select"]')
    ).toBeNull();
    expect(container.querySelector('[data-action-id="timeline.filters.topic.toggle"]')).toBeNull();
  });
});
