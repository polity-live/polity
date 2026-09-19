import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  page: vi.fn(() => ({ items: [] })),
  view: vi.fn(() => null),
  display: {} as Record<string, unknown>,
  save: vi.fn().mockResolvedValue(undefined),
  error: vi.fn(),
}));

vi.mock('../../hooks/useTimelinePage', () => ({ useTimelinePage: mocks.page }));
vi.mock('../ModernTimelineView', () => ({ ModernTimelineView: mocks.view }));

import { ModernTimeline, Timeline } from '../ModernTimeline';

describe('ModernTimeline LSF wrapper', () => {
  it('restores map visibility and reports a failed personal preference save', async () => {
    mocks.display = { timelineMapVisible: true };
    mocks.save.mockRejectedValueOnce(new Error('offline'));
    const element = ModernTimeline({});
    expect(element.props.mapVisible).toBe(true);
    element.props.onMapVisibilityChange(false);
    await Promise.resolve();
    expect(mocks.save).toHaveBeenCalledWith({ timelineMapVisible: false });
    expect(mocks.error).toHaveBeenCalledWith('common.workspace.saveFailed');
    mocks.display = {};
  });
  it('passes the requested scope to the page hook and enables virtualization', () => {
    const element = ModernTimeline({ className: 'timeline', userId: 'user-1', groupId: 'group-1' });
    expect(Timeline).toBe(ModernTimeline);
    expect(mocks.page).toHaveBeenCalledWith({ userId: 'user-1', groupId: 'group-1' });
    expect(element.props.virtualizeTimeline).toBe(true);
  });
});

vi.mock('@/zero/preferences/useWorkspacePreferences', () => ({
  useWorkspacePreferences: () => ({
    display: mocks.display,
    setDisplay: mocks.save,
  }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.error } }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
