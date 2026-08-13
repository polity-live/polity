/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActionBar, ActionBarCompact } from '../cards/ActionBar';
import { TimelineFilterPanel } from '../TimelineFilterPanel';
import { TimelineHeader } from '../TimelineHeader';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, values?: { defaultValue?: string }) => values?.defaultValue ?? key,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function actions(root: ParentNode, id: string) {
  const matches = root.querySelectorAll<HTMLElement>(`[data-action-id="${id}"]`);
  if (!matches.length) throw new Error(`Missing action ${id}`);
  return matches;
}

describe('timeline core action behavior', () => {
  it('renders title metadata and dispatches optional header settings', () => {
    const onSettingsClick = vi.fn();
    const { rerender } = render(
      <TimelineHeader
        mode="timeline"
        onModeChange={vi.fn()}
        sortBy="recent"
        onSortChange={vi.fn()}
        subtitle="Nearby activity"
        onSettingsClick={onSettingsClick}
      />
    );
    expect(screen.getByText('Nearby activity')).toBeTruthy();
    fireEvent.click(document.querySelector('[data-action-id="timeline.header.settings.open"]')!);
    expect(onSettingsClick).toHaveBeenCalledOnce();

    rerender(
      <TimelineHeader
        mode="timeline"
        onModeChange={vi.fn()}
        sortBy="recent"
        onSortChange={vi.fn()}
      />
    );
    expect(document.querySelector('[data-action-id="timeline.header.settings.open"]')).toBeNull();
  });
  it('dispatches universal follow, discussion, reaction, share, and bookmark effects', () => {
    const onFollow = vi.fn();
    const onDiscuss = vi.fn();
    const onReact = vi.fn();
    const onShare = vi.fn();
    const onBookmark = vi.fn();
    const { container } = render(
      <ActionBar
        entityId="group-1"
        entityType="group"
        onFollow={onFollow}
        onDiscuss={onDiscuss}
        onReact={onReact}
        onShare={onShare}
        onBookmark={onBookmark}
      />
    );

    fireEvent.click(actions(container, 'timeline.action-bar.follow.toggle')[0]);
    fireEvent.click(actions(container, 'timeline.action-bar.discussion.open')[0]);
    fireEvent.click(actions(container, 'timeline.action-bar.reaction.support')[0]);
    fireEvent.click(actions(container, 'timeline.action-bar.reaction.oppose')[0]);
    fireEvent.click(actions(container, 'timeline.action-bar.share')[0]);
    fireEvent.click(actions(container, 'timeline.action-bar.bookmark.toggle')[0]);
    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(onDiscuss).toHaveBeenCalledTimes(1);
    expect(onReact).toHaveBeenNthCalledWith(1, 'support');
    expect(onReact).toHaveBeenNthCalledWith(2, 'oppose');
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onBookmark).toHaveBeenCalledTimes(1);
  });

  it('dispatches compact reaction and discussion effects through focusable controls', () => {
    const onReact = vi.fn();
    const onDiscuss = vi.fn();
    const { container } = render(<ActionBarCompact onReact={onReact} onDiscuss={onDiscuss} />);
    const react = actions(container, 'timeline.action-bar.compact.reaction.toggle')[0];
    const discuss = actions(container, 'timeline.action-bar.compact.discussion.open')[0];
    react.focus();
    expect(document.activeElement).toBe(react);
    fireEvent.click(react);
    fireEvent.click(discuss);
    expect(onReact).toHaveBeenCalledTimes(1);
    expect(onDiscuss).toHaveBeenCalledTimes(1);
  });

  it('dispatches every filter family without coupling selections between controls', () => {
    const callbacks = {
      onClose: vi.fn(),
      onContentTypesChange: vi.fn(),
      onContentTypeToggle: vi.fn(),
      onDateRangeChange: vi.fn(),
      onTopicToggle: vi.fn(),
      onEngagementChange: vi.fn(),
      onResetFilters: vi.fn(),
      onRadiusChange: vi.fn(),
    };
    render(
      <TimelineFilterPanel
        open
        contentTypes={[]}
        dateRange="all"
        topics={[]}
        availableTopics={['climate']}
        engagement="all"
        hasActiveFilters
        contentTypeOptions={['group']}
        radiusKm="all"
        {...callbacks}
      />
    );

    fireEvent.click(actions(document, 'timeline.filters.reset')[0]);
    fireEvent.click(actions(document, 'timeline.filters.content.select-all')[0]);
    fireEvent.click(actions(document, 'timeline.filters.content.select-none')[0]);
    fireEvent.click(actions(document, 'timeline.filters.content.toggle')[0]);
    fireEvent.click(actions(document, 'timeline.filters.radius.select')[1]);
    fireEvent.click(actions(document, 'timeline.filters.date-range.select')[1]);
    fireEvent.click(actions(document, 'timeline.filters.engagement.select')[1]);
    fireEvent.click(actions(document, 'timeline.filters.topic.toggle')[0]);
    fireEvent.click(actions(document, 'timeline.filters.close')[0]);

    expect(callbacks.onResetFilters).toHaveBeenCalledTimes(1);
    expect(callbacks.onContentTypesChange).toHaveBeenNthCalledWith(1, ['group']);
    expect(callbacks.onContentTypesChange).toHaveBeenNthCalledWith(2, []);
    expect(callbacks.onContentTypeToggle).toHaveBeenCalledWith('group');
    expect(callbacks.onRadiusChange).toHaveBeenCalledWith(10);
    expect(callbacks.onDateRangeChange).toHaveBeenCalledWith('today');
    expect(callbacks.onEngagementChange).toHaveBeenCalledWith('popular');
    expect(callbacks.onTopicToggle).toHaveBeenCalledWith('climate');
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  });
});
