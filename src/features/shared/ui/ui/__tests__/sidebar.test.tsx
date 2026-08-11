// @vitest-environment jsdom

import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mobile: false }));

vi.mock('@/features/shared/hooks/useIsMobileScreen', () => ({
  useIsMobileScreen: () => mocks.mobile,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('lucide-react', () => ({ PanelLeft: () => <svg data-icon="panel-left" /> }));

vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: React.forwardRef(
    (
      {
        variant: _variant,
        size: _size,
        ...props
      }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: string;
        size?: string;
      },
      ref: React.ForwardedRef<HTMLButtonElement>
    ) => <button ref={ref} {...props} />
  ),
}));
vi.mock('@/features/shared/ui/ui/input.tsx', () => ({
  Input: React.forwardRef(
    (
      props: React.InputHTMLAttributes<HTMLInputElement>,
      ref: React.ForwardedRef<HTMLInputElement>
    ) => <input ref={ref} {...props} />
  ),
}));
vi.mock('@/features/shared/ui/ui/separator.tsx', () => ({
  Separator: React.forwardRef(
    (props: React.HTMLAttributes<HTMLDivElement>, ref: React.ForwardedRef<HTMLDivElement>) => (
      <div ref={ref} {...props} />
    )
  ),
}));
vi.mock('@/features/shared/ui/ui/sheet.tsx', () => ({
  Sheet: ({ children, open, onOpenChange: _onOpenChange }: any) => (
    <div data-testid="sheet" data-open={String(open)}>
      {children}
    </div>
  ),
  SheetContent: ({ children, side, ...props }: any) => (
    <div data-testid="sheet-content" data-side={side} {...props}>
      {children}
    </div>
  ),
}));
vi.mock('@/features/shared/ui/ui/skeleton.tsx', () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));
vi.mock('@/features/shared/ui/ui/tooltip.tsx', () => ({
  TooltipProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children, hidden, side: _side, align: _align, ...props }: any) => (
    <div data-testid="tooltip-content" data-hidden={String(hidden)} {...props}>
      {children}
    </div>
  ),
  TooltipHint: ({ children, content }: { children?: React.ReactNode; content: string }) => (
    <div data-hint={content}>{children}</div>
  ),
}));

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '../sidebar';

function ContextControls() {
  const sidebar = useSidebar();
  return (
    <div>
      <span data-testid="context-state">{`${sidebar.state}:${sidebar.isMobile}`}</span>
      <button onClick={() => sidebar.setOpen(false)}>close-directly</button>
      <button onClick={sidebar.toggleSidebar}>toggle-context</button>
    </div>
  );
}

function Primitives() {
  return (
    <>
      <SidebarInset data-testid="inset" className="custom" />
      <SidebarInput aria-label="sidebar-input" className="custom" />
      <SidebarHeader data-testid="header" />
      <SidebarFooter data-testid="footer" />
      <SidebarSeparator data-testid="separator" />
      <SidebarContent data-testid="content" />
      <SidebarGroup data-testid="group">
        <SidebarGroupLabel>Label</SidebarGroupLabel>
        <SidebarGroupLabel asChild>
          <span>Child label</span>
        </SidebarGroupLabel>
        <SidebarGroupAction>Action</SidebarGroupAction>
        <SidebarGroupAction asChild>
          <a href="#action">Child action</a>
        </SidebarGroupAction>
        <SidebarGroupContent>Group content</SidebarGroupContent>
      </SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>Plain button</SidebarMenuButton>
          <SidebarMenuButton tooltip="String tip" variant="outline" size="sm" isActive>
            String tooltip button
          </SidebarMenuButton>
          <SidebarMenuButton tooltip={{ children: 'Object tip' }} size="lg">
            Object tooltip button
          </SidebarMenuButton>
          <SidebarMenuButton asChild>
            <a href="#menu">Child menu button</a>
          </SidebarMenuButton>
          <SidebarMenuAction>Menu action</SidebarMenuAction>
          <SidebarMenuAction showOnHover>Hover action</SidebarMenuAction>
          <SidebarMenuAction asChild>
            <a href="#menu-action">Child menu action</a>
          </SidebarMenuAction>
          <SidebarMenuBadge>3</SidebarMenuBadge>
          <SidebarMenuSkeleton />
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <SidebarMenuSubButton size="sm">Small sub</SidebarMenuSubButton>
          <SidebarMenuSubButton size="md" isActive>
            Medium sub
          </SidebarMenuSubButton>
          <SidebarMenuSubButton asChild>
            <a href="#sub">Child sub</a>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    </>
  );
}

beforeEach(() => {
  mocks.mobile = false;
  document.cookie = 'sidebar:state=; max-age=0';
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('sidebar primitives', () => {
  it('requires a provider', () => {
    expect(() => renderHook(() => useSidebar())).toThrow(
      'useSidebar must be used within a SidebarProvider.'
    );
  });

  it('renders every desktop primitive, variant, and uncontrolled state transition', () => {
    const triggerClick = vi.fn();
    const rendered = render(
      <SidebarProvider className="provider" style={{ color: 'red' }} data-testid="provider">
        <ContextControls />
        <Sidebar collapsible="none" className="always">
          <span>Always</span>
        </Sidebar>
        <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
          <span>Left</span>
        </Sidebar>
        <Sidebar side="right" variant="floating" collapsible="icon">
          <span>Right</span>
        </Sidebar>
        <Sidebar side="left" variant="inset" collapsible="icon">
          <span>Inset</span>
        </Sidebar>
        <SidebarTrigger onClick={triggerClick} />
        <SidebarRail />
        <Primitives />
      </SidebarProvider>
    );
    expect(screen.getByTestId('context-state').textContent).toBe('expanded:false');
    expect(screen.getByTestId('provider').className).toContain('provider');
    expect(screen.getByText('Always').parentElement?.className).toContain('always');
    expect(rendered.container.querySelector('[data-side="right"]')).toBeTruthy();
    expect(rendered.container.querySelector('[data-variant="floating"]')).toBeTruthy();
    expect(rendered.container.querySelector('[data-variant="inset"]')).toBeTruthy();
    expect(rendered.container.querySelectorAll('[data-sidebar="menu-button"]')).toHaveLength(4);
    expect(rendered.container.querySelector('[data-sidebar="menu-skeleton-icon"]')).toBeTruthy();
    expect(
      rendered.container.querySelector('[data-sidebar="menu-skeleton-text"]')?.getAttribute('style')
    ).toContain('70%');

    fireEvent.click(screen.getByText('close-directly'));
    expect(screen.getByTestId('context-state').textContent).toBe('collapsed:false');
    expect(document.cookie).toContain('sidebar:state=false');

    fireEvent.click(rendered.container.querySelector('[data-sidebar="trigger"]')!);
    expect(triggerClick).toHaveBeenCalled();
    expect(screen.getByTestId('context-state').textContent).toBe('expanded:false');
    fireEvent.click(rendered.container.querySelector('[data-sidebar="rail"]')!);
    expect(screen.getByTestId('context-state').textContent).toBe('collapsed:false');

    const unrelated = new KeyboardEvent('keydown', { key: 'x', metaKey: true, cancelable: true });
    window.dispatchEvent(unrelated);
    const plainB = new KeyboardEvent('keydown', { key: 'b', cancelable: true });
    window.dispatchEvent(plainB);
    const metaB = new KeyboardEvent('keydown', { key: 'b', metaKey: true, cancelable: true });
    window.dispatchEvent(metaB);
    expect(metaB.defaultPrevented).toBe(true);
    const ctrlB = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, cancelable: true });
    window.dispatchEvent(ctrlB);
    expect(ctrlB.defaultPrevented).toBe(true);
  });

  it('uses controlled state callbacks', () => {
    const onOpenChange = vi.fn();
    const rendered = render(
      <SidebarProvider open={false} onOpenChange={onOpenChange}>
        <ContextControls />
        <SidebarTrigger />
        <SidebarMenuButton tooltip="Collapsed tip">Button</SidebarMenuButton>
      </SidebarProvider>
    );
    expect(screen.getByTestId('context-state').textContent).toBe('collapsed:false');
    fireEvent.click(rendered.container.querySelector('[data-sidebar="trigger"]')!);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('tooltip-content').getAttribute('data-hidden')).toBe('false');
  });

  it('uses mobile sheets and mobile toggle state', () => {
    mocks.mobile = true;
    const rendered = render(
      <SidebarProvider defaultOpen={false}>
        <ContextControls />
        <Sidebar side="right">
          <span>Mobile sidebar</span>
        </Sidebar>
        <SidebarTrigger />
        <SidebarMenuButton tooltip="Mobile tip">Button</SidebarMenuButton>
      </SidebarProvider>
    );
    expect(screen.getByTestId('context-state').textContent).toBe('collapsed:true');
    expect(screen.getByTestId('sheet').getAttribute('data-open')).toBe('false');
    expect(screen.getByTestId('sheet-content').getAttribute('data-side')).toBe('right');
    expect(screen.getByTestId('tooltip-content').getAttribute('data-hidden')).toBe('true');
    fireEvent.click(screen.getByText('toggle-context'));
    expect(screen.getByTestId('sheet').getAttribute('data-open')).toBe('true');
    fireEvent.click(rendered.container.querySelector('[data-sidebar="trigger"]')!);
    expect(screen.getByTestId('sheet').getAttribute('data-open')).toBe('false');
  });
});
