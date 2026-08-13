/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { Bell } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotificationsList } from '../NotificationsList';

afterEach(() => {
  cleanup();
});

describe('NotificationsList loading state', () => {
  it('renders section skeleton rows instead of the feed loading icon', () => {
    render(
      <NotificationsList
        notifications={[]}
        isLoading
        emptyIcon={Bell}
        emptyTitle="No notifications"
        emptyDescription="Nothing yet"
        onNotificationClick={vi.fn()}
      />
    );

    expect(document.querySelector('[data-slot="section-skeleton"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="feed-state-panel"]')).toBeNull();
  });
});
