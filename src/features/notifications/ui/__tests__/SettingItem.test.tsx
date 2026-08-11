/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingItem } from '../SettingItem';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('SettingItem', () => {
  it('forwards its consumer action id and switch interaction contract', () => {
    const onCheckedChange = vi.fn();
    const { container, rerender } = render(
      <SettingItem
        data-action-id="notifications.settings.toggle.example"
        label="Example preference"
        description="Example description"
        checked={false}
        onCheckedChange={onCheckedChange}
        adminOnly
      />
    );

    const control = screen.getByRole('switch');
    expect(control.getAttribute('data-action-id')).toBe('notifications.settings.toggle.example');
    control.focus();
    expect(document.activeElement).toBe(control);
    fireEvent.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('pages.notifications.settingsPage.adminOnly')).toBeTruthy();

    rerender(
      <SettingItem
        data-action-id="notifications.settings.toggle.example"
        label="Example preference"
        checked
        disabled
        onCheckedChange={onCheckedChange}
      />
    );
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain('Example preference');
  });
});
