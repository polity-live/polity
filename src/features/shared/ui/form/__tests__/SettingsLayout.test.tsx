/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TabsContent } from '@/features/shared/ui/ui/tabs';
import { SettingsActionBar, SettingsPage, SettingsTabs } from '../SettingsLayout';

afterEach(cleanup);

function TestSettings({ onChange = vi.fn() }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('general');

  return (
    <SettingsPage title="Settings" description="Manage the entity">
      <SettingsTabs
        value={value}
        onValueChange={nextValue => {
          setValue(nextValue);
          onChange(nextValue);
        }}
        tabs={[
          { value: 'general', label: 'General' },
          { value: 'workflow', label: 'Workflow' },
        ]}
      >
        <TabsContent value="general">General content</TabsContent>
        <TabsContent value="workflow">Workflow content</TabsContent>
      </SettingsTabs>
      <SettingsActionBar>Save controls</SettingsActionBar>
    </SettingsPage>
  );
}

describe('SettingsLayout', () => {
  it('renders a consistent page header and switches controlled tabs', () => {
    const onChange = vi.fn();
    render(<TestSettings onChange={onChange} />);

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByText('General content')).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Workflow' }), {
      button: 0,
      ctrlKey: false,
    });

    expect(onChange).toHaveBeenCalledWith('workflow');
    expect(screen.getByText('Workflow content')).toBeTruthy();
  });

  it('keeps tab navigation horizontally scrollable and actions sticky', () => {
    const { container } = render(<TestSettings />);
    const tabList = screen.getByRole('tablist');
    const actionBar = container.querySelector('[data-slot="settings-action-bar"]');

    expect(tabList.className).toContain('overflow-x-auto');
    expect(actionBar?.className).toContain('sticky');
    expect(actionBar?.className).toContain('bottom-3');
  });
});
