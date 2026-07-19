/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
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
});
