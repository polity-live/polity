import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  page: vi.fn(() => ({ items: [] })),
  view: vi.fn(() => null),
}));

vi.mock('../../hooks/useTimelinePage', () => ({ useTimelinePage: mocks.page }));
vi.mock('../ModernTimelineView', () => ({ ModernTimelineView: mocks.view }));

import { ModernTimeline, Timeline } from '../ModernTimeline';

describe('ModernTimeline LSF wrapper', () => {
  it('passes the requested scope to the page hook and enables virtualization', () => {
    const element = ModernTimeline({ className: 'timeline', userId: 'user-1', groupId: 'group-1' });
    expect(Timeline).toBe(ModernTimeline);
    expect(mocks.page).toHaveBeenCalledWith({ userId: 'user-1', groupId: 'group-1' });
    expect(element.props.virtualizeTimeline).toBe(true);
  });
});
