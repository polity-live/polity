/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TabsContent } from '@/features/shared/ui/ui/tabs';
import {
  FloatingActionBar,
  ManagementToolbar,
  ManagementSection,
  SettingsActionBar,
  SettingsPage,
  SettingsTabs,
} from '../SettingsLayout';

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
        action={<button type="button">Invite</button>}
      >
        <ManagementToolbar>Search and filters</ManagementToolbar>
        <TabsContent value="general">General content</TabsContent>
        <TabsContent value="workflow">Workflow content</TabsContent>
      </SettingsTabs>
      <SettingsActionBar>Save controls</SettingsActionBar>
      <ManagementSection title="Active memberships" description="Current group memberships">
        <div data-testid="membership-table">Table</div>
      </ManagementSection>
    </SettingsPage>
  );
}

describe('SettingsLayout', () => {
  it('exposes the floating action surface without changing the settings action slot', () => {
    const { container } = render(
      <>
        <FloatingActionBar>Floating controls</FloatingActionBar>
        <SettingsActionBar>Settings controls</SettingsActionBar>
      </>
    );

    const floatingBar = container.querySelector('[data-slot="floating-action-bar"]');
    const settingsBar = container.querySelector('[data-slot="settings-action-bar"]');

    expect(floatingBar?.className).toContain('backdrop-blur');
    expect(floatingBar?.className).toContain('shadow-lg');
    expect(settingsBar?.className).toContain('sticky');
  });

  it('keeps a semantic heading without rendering a visible page header in sr-only mode', () => {
    const { container } = render(
      <SettingsPage title="Participants" description="Town Hall" headingMode="sr-only">
        <div>Participant controls</div>
      </SettingsPage>
    );

    const heading = screen.getByRole('heading', { name: 'Participants' });
    const page = container.querySelector('[data-slot="settings-page"]');
    expect(heading.className).toBe('');
    expect(heading.closest('header')?.className).toContain('sr-only');
    expect(page?.className).not.toContain('space-y-6');
    expect(container.querySelector('[data-slot="page-header"]')).toBeNull();
    expect(screen.getByText('Participant controls')).toBeTruthy();
  });

  it('renders a consistent page header and switches controlled tabs', () => {
    const onChange = vi.fn();
    render(<TestSettings onChange={onChange} />);

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByText('General content')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Workflow' }), {
      button: 0,
      ctrlKey: false,
    });

    expect(onChange).toHaveBeenCalledWith('workflow');
    expect(screen.getByText('Workflow content')).toBeTruthy();
  });

  it('keeps tab navigation scrollable, actions sticky, and management controls chromeless', () => {
    const { container } = render(<TestSettings />);
    const tabList = screen.getByRole('tablist');
    const actionBar = container.querySelector('[data-slot="settings-action-bar"]');
    const toolbar = container.querySelector('[data-slot="management-toolbar"]');

    expect(tabList.className).toContain('overflow-x-auto');
    expect(actionBar?.className).toContain('sticky');
    expect(actionBar?.className).toContain('bottom-3');
    expect(toolbar?.classList.contains('flex')).toBe(true);
    expect(toolbar?.className).toContain('sm:flex-row');
    expect(toolbar?.className).toContain('[&>*]:min-w-0');
    expect(toolbar?.className).toContain('[&_[data-slot=participation-role-filter]]:mb-0');
    expect(toolbar?.classList.contains('rounded-lg')).toBe(false);
    expect(toolbar?.classList.contains('border')).toBe(false);
    expect(toolbar?.classList.contains('bg-muted/20')).toBe(false);
    expect(toolbar?.classList.contains('p-3')).toBe(false);
  });

  it('renders management headings on the page background above the table surface', () => {
    const { container } = render(<TestSettings />);
    const section = container.querySelector('[data-slot="management-section"]');
    const header = container.querySelector('[data-slot="management-section-header"]');
    const content = container.querySelector('[data-slot="management-section-content"]');

    expect(section?.className).toContain('space-y-3');
    expect(section?.className).not.toContain('border');
    expect(header?.parentElement).toBe(section);
    expect(content?.parentElement).toBe(section);
    expect(content?.contains(header)).toBe(false);
    expect(screen.getByText('Active memberships')).toBeTruthy();
    expect(screen.getByTestId('membership-table')).toBeTruthy();
  });
});
