/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotificationSettingsContentView } from '../NotificationSettingsContentView';

const mocks = vi.hoisted(() => ({
  selectChange: undefined as undefined | ((value: string) => void),
  settingChanges: new Map<string, (value: boolean) => void>(),
}));

vi.mock('@/features/notifications/ui/push-notification-toggle', () => ({
  PushNotificationToggle: () => <div data-testid="push-settings" />,
}));

vi.mock('../SettingItem', () => ({
  SettingItem: ({
    'data-action-id': actionId,
    label,
    checked,
    disabled,
    onCheckedChange,
  }: {
    'data-action-id': string;
    label: string;
    checked: boolean;
    disabled?: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    mocks.settingChanges.set(actionId, onCheckedChange),
    (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-action-id={actionId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
      >
        {label}
      </button>
    )
  ),
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
  FormControlSelect: ({
    children,
    onValueChange,
    ...props
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => {
    mocks.selectChange = onValueChange;
    return <div {...props}>{children}</div>;
  },
  FormControlSelectTrigger: ({ children, ...props }: ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  FormControlSelectValue: () => <span>refresh frequency</span>,
  FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormControlSelectItem: ({
    children,
    value,
    ...props
  }: ComponentProps<'button'> & { value: string }) => (
    <button type="button" {...props} onClick={() => mocks.selectChange?.(value)}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: ({ label }: { label: string }) => <div>{label}</div>,
}));

const SETTING_KEYS = {
  deliverySettings: ['inAppNotifications', 'emailNotifications'],
  groupNotifications: [
    'tasksAssigned',
    'paymentNotifications',
    'newEvents',
    'newAmendments',
    'newRelationships',
    'newRoles',
    'newDocuments',
    'newMembers',
    'roleUpdates',
    'newSubscribers',
    'profileUpdates',
    'membershipRequests',
    'membershipInvitations',
  ],
  eventNotifications: [
    'agendaItems',
    'elections',
    'votes',
    'scheduleChanges',
    'newParticipants',
    'roleUpdates',
    'roleChanges',
    'profileUpdates',
    'newSubscribers',
    'participationRequests',
    'participationInvitations',
    'delegateNominations',
    'speakerListAdditions',
    'meetingBookings',
  ],
  amendmentNotifications: [
    'changeRequests',
    'changeRequestDecisions',
    'newCollaborators',
    'roleUpdates',
    'upvotesDownvotes',
    'newSubscribers',
    'processProgress',
    'supportingGroups',
    'clones',
    'discussions',
    'profileUpdates',
    'workflowChanges',
    'collaborationRequests',
    'collaborationInvitations',
    'votingSessions',
  ],
  blogNotifications: [
    'newSubscribers',
    'upvotesDownvotes',
    'profileUpdates',
    'newWriters',
    'roleUpdates',
    'comments',
    'writerRequests',
    'writerInvitations',
  ],
  todoNotifications: [
    'taskAssigned',
    'taskUpdated',
    'taskCompleted',
    'comments',
    'dueDateReminders',
    'overdueAlerts',
  ],
  socialNotifications: [
    'newFollowers',
    'mentions',
    'directMessages',
    'conversationRequests',
    'documentInvitations',
  ],
  timelineSettings: ['showOnHomepage'],
} as const;

const UPDATER_BY_CATEGORY = {
  deliverySettings: 'updateDeliverySettings',
  groupNotifications: 'updateGroupNotifications',
  eventNotifications: 'updateEventNotifications',
  amendmentNotifications: 'updateAmendmentNotifications',
  blogNotifications: 'updateBlogNotifications',
  todoNotifications: 'updateTodoNotifications',
  socialNotifications: 'updateSocialNotifications',
  timelineSettings: 'updateTimelineSettings',
} as const;

function slug(value: string) {
  return value
    .replace(/Settings$/, '')
    .replace(/Notifications$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function createProps(overrides: Record<string, unknown> = {}) {
  const settings = Object.fromEntries(
    Object.entries(SETTING_KEYS).map(([category, keys]) => [
      category,
      Object.fromEntries(keys.map(key => [key, false])),
    ])
  ) as Record<string, Record<string, boolean | string>>;
  settings.timelineSettings.refreshFrequency = 'realtime';

  return {
    userId: 'user-1',
    t: (key: string) => key,
    settings,
    isLoading: false,
    isUpdating: false,
    updateGroupNotifications: vi.fn(),
    updateEventNotifications: vi.fn(),
    updateAmendmentNotifications: vi.fn(),
    updateBlogNotifications: vi.fn(),
    updateTodoNotifications: vi.fn(),
    updateSocialNotifications: vi.fn(),
    updateDeliverySettings: vi.fn(),
    updateTimelineSettings: vi.fn(),
    resetToDefaults: vi.fn(),
    resetting: false,
    setResetting: vi.fn(),
    handleReset: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  mocks.selectChange = undefined;
  mocks.settingChanges.clear();
});

describe('NotificationSettingsContentView', () => {
  it('dispatches every notification preference through stable settings actions', () => {
    const props = createProps();
    const { container } = render(<NotificationSettingsContentView {...props} />);

    for (const [category, keys] of Object.entries(SETTING_KEYS)) {
      const updaterName = UPDATER_BY_CATEGORY[category as keyof typeof UPDATER_BY_CATEGORY];
      const updater = props[updaterName];
      for (const key of keys) {
        const actionId = `notifications.settings.toggle.${slug(category)}-${slug(key)}`;
        const control = container.querySelector(
          `[data-action-id="${actionId}"]`
        ) as HTMLButtonElement;
        if (category === 'deliverySettings' && key === 'emailNotifications') {
          expect(control.disabled).toBe(true);
          continue;
        }
        fireEvent.click(control);
        expect(updater).toHaveBeenLastCalledWith({ [key]: true });
      }
    }

    fireEvent.click(
      container.querySelector('[data-action-id="notifications.settings.reset.defaults"]')!
    );
    expect(props.handleReset).toHaveBeenCalledOnce();

    for (const value of ['realtime', 'every5min', 'every15min', 'manual']) {
      fireEvent.click(
        container.querySelector(
          `[data-action-id="notifications.settings.select.refresh-frequency-${value === 'every5min' ? 'every-5-min' : value === 'every15min' ? 'every-15-min' : value}"]`
        )!
      );
      expect(props.updateTimelineSettings).toHaveBeenLastCalledWith({ refreshFrequency: value });
    }
  });

  it('publishes loading and disabled settings states without dispatching changes', () => {
    const loading = createProps({ isLoading: true });
    const { rerender, container } = render(<NotificationSettingsContentView {...loading} />);
    expect(screen.getByText('common.loading.pageSkeleton.settings')).toBeTruthy();

    const disabled = createProps({ isUpdating: true });
    rerender(<NotificationSettingsContentView {...disabled} />);
    const reset = container.querySelector(
      '[data-action-id="notifications.settings.reset.defaults"]'
    );
    const firstSwitch = container.querySelector(
      '[data-action-id^="notifications.settings.toggle"]'
    );
    expect((reset as HTMLButtonElement).disabled).toBe(true);
    expect((firstSwitch as HTMLButtonElement).disabled).toBe(true);

    rerender(<NotificationSettingsContentView {...createProps({ resetting: true })} />);
    expect(container.querySelector('.lucide-loader-circle')).toBeTruthy();
  });

  it('requests browser permission only when in-app notifications are enabled from default', () => {
    const requestPermission = vi.fn();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default', requestPermission },
    });
    const props = createProps();
    const { container, rerender } = render(<NotificationSettingsContentView {...props} />);
    fireEvent.click(
      container.querySelector('[data-action-id="notifications.settings.toggle.delivery-in-app"]')!
    );
    expect(props.updateDeliverySettings).toHaveBeenLastCalledWith({ inAppNotifications: true });
    expect(requestPermission).toHaveBeenCalledOnce();

    mocks.settingChanges.get('notifications.settings.toggle.delivery-email')?.(true);
    expect(props.updateDeliverySettings).toHaveBeenLastCalledWith({ emailNotifications: true });

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'granted', requestPermission },
    });
    rerender(<NotificationSettingsContentView {...createProps()} />);
    fireEvent.click(
      container.querySelector('[data-action-id="notifications.settings.toggle.delivery-in-app"]')!
    );
    expect(requestPermission).toHaveBeenCalledOnce();

    const enabled = createProps();
    enabled.settings.deliverySettings.inAppNotifications = true;
    rerender(<NotificationSettingsContentView {...enabled} />);
    fireEvent.click(
      container.querySelector('[data-action-id="notifications.settings.toggle.delivery-in-app"]')!
    );
    expect(enabled.updateDeliverySettings).toHaveBeenLastCalledWith({ inAppNotifications: false });
    expect(requestPermission).toHaveBeenCalledOnce();
  });
});
