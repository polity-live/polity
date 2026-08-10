/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Tabs } from '@/features/shared/ui/ui/tabs';
import { NotificationTabs } from '../NotificationTabs';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('NotificationTabs', () => {
  it('uses its content width while remaining constrained and scrollable', () => {
    render(
      <Tabs defaultValue="all">
        <NotificationTabs
          allCount={2}
          unreadCount={1}
          personalCount={1}
          entityCount={0}
          trashCount={0}
        />
      </Tabs>
    );

    const tabList = screen.getByRole('tablist');
    expect(tabList.className).toContain('w-fit');
    expect(tabList.className).toContain('max-w-full');
    expect(tabList.className).toContain('overflow-x-auto');
  });

  it('selects every notification scope through stable tab actions', () => {
    const { container } = render(
      <Tabs defaultValue="all">
        <NotificationTabs
          allCount={2}
          unreadCount={1}
          personalCount={1}
          entityCount={1}
          trashCount={1}
        />
      </Tabs>
    );

    for (const value of ['all', 'unread', 'read', 'personal', 'entity', 'trash']) {
      const tab = container.querySelector(`[data-action-id="notifications.tabs.select.${value}"]`);
      expect(tab).toBeTruthy();
      fireEvent.mouseDown(tab!, { button: 0, ctrlKey: false });
      expect(tab?.getAttribute('data-state')).toBe('active');
    }
  });
});
