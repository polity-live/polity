// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-toolbar', () => ({
  Root: ({ children, ...props }: any) => (
    <div data-testid="toolbar" {...props}>
      {children}
    </div>
  ),
  ToolbarToggleGroup: ({ children, ...props }: any) => (
    <div data-testid="toggle-group" {...props}>
      {children}
    </div>
  ),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  Separator: (props: any) => <hr data-testid="toolbar-separator" {...props} />,
  Button: ({ children, asChild: _asChild, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  ToggleItem: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('class-variance-authority', () => ({
  cva: (base: string) => (options?: Record<string, unknown>) =>
    `${base} size-${options?.size ?? 'default'} variant-${options?.variant ?? 'default'}`,
}));

vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenuLabel: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DropdownMenuRadioGroup: ({ children, ...props }: any) => (
    <div data-testid="menu-group" {...props}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: (props: any) => <hr data-testid="menu-separator" {...props} />,
}));

vi.mock('@/features/shared/ui/ui/separator.tsx', () => ({
  Separator: (props: any) => <hr data-testid="group-separator" {...props} />,
}));

vi.mock('@/features/shared/ui/ui/tooltip.tsx', () => ({
  Tooltip: ({ children, ...props }: any) => (
    <div data-testid="tooltip" {...props}>
      {children}
    </div>
  ),
  TooltipContent: ({ children, ...props }: any) => (
    <span data-testid="tooltip-content" {...props}>
      {children}
    </span>
  ),
  TooltipTrigger: ({ children, asChild: _asChild, ...props }: any) => (
    <span data-testid="tooltip-trigger" {...props}>
      {children}
    </span>
  ),
}));

vi.mock('lucide-react', () => ({
  Check: () => <i data-testid="check" />,
  ChevronDown: () => <i data-testid="chevron" />,
  Loader2: () => <i data-testid="loader" />,
}));

import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarLink,
  ToolbarMenuGroup,
  ToolbarSeparator,
  ToolbarSplitButton,
  ToolbarSplitButtonPrimary,
  ToolbarSplitButtonSecondary,
  ToolbarToggleGroup,
  ToolbarToggleItem,
  ToolbarTooltipContainer,
} from '../Toolbar';

afterEach(cleanup);

describe('Toolbar branch contracts', () => {
  it('renders primitive wrappers with custom classes', () => {
    render(
      <Toolbar className="toolbar-class">
        <ToolbarToggleGroup type="single" className="toggle-class">
          <ToolbarToggleItem value="one" className="item-class">
            One
          </ToolbarToggleItem>
        </ToolbarToggleGroup>
        <ToolbarLink href="#target" className="link-class">
          Link
        </ToolbarLink>
        <ToolbarSeparator className="separator-class" />
        <ToolbarGroup className="group-class">
          <button type="button">Grouped</button>
        </ToolbarGroup>
      </Toolbar>
    );
    expect(screen.getByTestId('toolbar').className).toContain('toolbar-class');
    expect(screen.getByTestId('toggle-group').className).toContain('toggle-class');
    expect(screen.getByText('One').className).toContain('item-class');
    expect(screen.getByText('Link').className).toContain('link-class');
    expect(screen.getByTestId('group-separator')).toBeTruthy();
  });

  it('renders an ordinary button without status content', () => {
    render(<ToolbarButton>Plain</ToolbarButton>);
    expect(screen.getByText('Plain')).toBeTruthy();
    expect(screen.queryByTestId('loader')).toBeNull();
    expect(screen.queryByTestId('check')).toBeNull();
  });

  it('renders loading and success states with and without labels', () => {
    const loading = render(
      <ToolbarButton loading loadingLabel="Saving">
        Save
      </ToolbarButton>
    );
    expect(screen.getByTestId('loader')).toBeTruthy();
    expect(screen.getByText('Saving')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
    loading.unmount();

    const loadingNoLabel = render(<ToolbarButton loading>Save</ToolbarButton>);
    expect(screen.getByTestId('loader')).toBeTruthy();
    loadingNoLabel.unmount();

    const success = render(
      <ToolbarButton successState successLabel="Saved">
        Save
      </ToolbarButton>
    );
    expect(screen.getByTestId('check')).toBeTruthy();
    expect(screen.getByText('Saved')).toBeTruthy();
    success.unmount();

    render(<ToolbarButton successState>Save</ToolbarButton>);
    expect(screen.getByTestId('check')).toBeTruthy();
  });

  it('suppresses status replacement for asChild and renders dropdown affordances', () => {
    render(
      <ToolbarButton asChild loading isDropdown>
        Child action
      </ToolbarButton>
    );
    expect(screen.queryByTestId('loader')).toBeNull();
    expect(screen.getByRole('button').className).toContain('pr-1');
  });

  it('renders pressed toggle states and disabled combinations', () => {
    const pressed = render(
      <ToolbarButton pressed isDropdown loading={false} disabled={false}>
        Pressed
      </ToolbarButton>
    );
    expect(screen.getByText('Pressed').closest('button')?.getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.queryByRole('radio')).toBeNull();
    pressed.unmount();

    render(
      <ToolbarButton pressed={false} disabled>
        Released
      </ToolbarButton>
    );
    expect(screen.getByText('Released').closest('button')?.getAttribute('aria-pressed')).toBe(
      'false'
    );
    expect(screen.getByText('Released').closest('button')?.disabled).toBe(true);
    cleanup();

    render(
      <ToolbarButton pressed loading successState loadingLabel="Working">
        Stateful
      </ToolbarButton>
    );
    const stateful = screen.getByText('Stateful').closest('button');
    expect(stateful?.getAttribute('data-loading')).toBe('true');
    expect(stateful?.getAttribute('data-success')).toBe('true');
    expect(stateful?.className).toContain('relative');
  });

  it('renders split-button parts and stops secondary click bubbling', () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <ToolbarSplitButton className="split">Split</ToolbarSplitButton>
        <ToolbarSplitButtonPrimary className="primary" size="lg" variant="outline">
          Primary
        </ToolbarSplitButtonPrimary>
        <ToolbarSplitButtonSecondary
          aria-label="More split options"
          className="secondary"
          size="default"
          variant="outline"
        />
      </div>
    );
    expect(screen.getByText('Split').className).toContain('split');
    expect(screen.getByText('Primary').className).toContain('primary');
    fireEvent.click(screen.getByRole('button', { name: 'More split options' }));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('uses tooltip, title fallback, shortcut props, and ordinary triggers', () => {
    const first = render(
      <ToolbarButton
        tooltip="Tip"
        tooltipShortcut={{ key: 'B' } as any}
        tooltipVariant="compact"
        asChild={false}
      >
        Action
      </ToolbarButton>
    );
    expect(screen.getByTestId('tooltip')).toBeTruthy();
    expect(screen.getByTestId('tooltip-content').textContent).toBe('Tip');
    first.unmount();

    render(<ToolbarButton title="Title fallback">Titled</ToolbarButton>);
    expect(screen.getByText('Title fallback')).toBeTruthy();
  });

  it('wraps disabled, loading, string, and node tooltips accessibly', () => {
    const disabled = render(
      <ToolbarButton disabled tooltip="Unavailable">
        Disabled
      </ToolbarButton>
    );
    expect(
      screen.getByTestId('tooltip-trigger').firstElementChild?.getAttribute('aria-label')
    ).toBe('Unavailable');
    disabled.unmount();

    const loading = render(
      <ToolbarButton loading tooltip="Loading tip">
        Loading
      </ToolbarButton>
    );
    expect(screen.getByTestId('tooltip-trigger')).toBeTruthy();
    loading.unmount();

    render(
      <ToolbarButton disabled tooltip={<strong>Node tip</strong>}>
        Node
      </ToolbarButton>
    );
    expect(
      screen.getByTestId('tooltip-trigger').firstElementChild?.getAttribute('aria-label')
    ).toBeNull();
  });

  it('renders a tooltip container without tooltip copy', () => {
    render(<ToolbarTooltipContainer Component="button" componentProps={{ children: 'Direct' }} />);
    expect(screen.getByText('Direct')).toBeTruthy();
    expect(screen.queryByTestId('tooltip')).toBeNull();
  });

  it('renders menu groups with and without labels', () => {
    const labeled = render(<ToolbarMenuGroup label="Formatting">Item</ToolbarMenuGroup>);
    expect(screen.getByText('Formatting')).toBeTruthy();
    expect(screen.getByTestId('menu-separator')).toBeTruthy();
    labeled.unmount();

    render(<ToolbarMenuGroup className="menu">Only item</ToolbarMenuGroup>);
    expect(screen.queryByText('Formatting')).toBeNull();
    expect(screen.getByTestId('menu-group').className).toContain('menu');
  });
});
