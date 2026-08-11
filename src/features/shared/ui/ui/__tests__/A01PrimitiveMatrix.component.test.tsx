/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dayPickerProps: null as any }));

vi.mock('@radix-ui/react-menubar', async () => {
  const React = await import('react');
  const Primitive = Object.assign(
    React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
    { displayName: 'Primitive' }
  );
  return Object.fromEntries(
    [
      'Root',
      'Menu',
      'Group',
      'Portal',
      'Sub',
      'RadioGroup',
      'Trigger',
      'SubTrigger',
      'SubContent',
      'Content',
      'Item',
      'CheckboxItem',
      'RadioItem',
      'Label',
      'Separator',
      'ItemIndicator',
    ].map(name => [name, Primitive])
  );
});
vi.mock('@radix-ui/react-navigation-menu', async () => {
  const React = await import('react');
  const Primitive = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));
  return Object.fromEntries(
    ['Root', 'List', 'Item', 'Trigger', 'Content', 'Link', 'Viewport', 'Indicator'].map(name => [
      name,
      Primitive,
    ])
  );
});
vi.mock('cmdk', async () => {
  const React = await import('react');
  const Primitive = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));
  return {
    Command: Object.assign(Primitive, {
      Empty: Primitive,
      Group: Primitive,
      Input: Primitive,
      Item: Primitive,
      List: Primitive,
      Separator: Primitive,
    }),
  };
});
vi.mock('@/features/shared/ui/ui/dialog.tsx', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('react-day-picker', async () => {
  const React = await import('react');
  return {
    DayButton: React.forwardRef<HTMLButtonElement, any>((props, ref) => (
      <button ref={ref} {...props} />
    )),
    DayPicker: (props: any) => {
      mocks.dayPickerProps = props;
      return <div data-testid="day-picker" />;
    },
    getDefaultClassNames: () => ({}),
  };
});

import { OTPInputContext } from 'input-otp';
import { BreadcrumbLink, BreadcrumbSeparator } from '../breadcrumb';
import { Calendar } from '../calendar';
import { CardDescription, CardHeader, CardTitle } from '../card';
import { CommandDialog } from '../command';
import { FieldSeparator } from '../field';
import { InputOTPSlot } from '../input-otp';
import { Item, ItemMedia } from '../item';
import { MenubarContent, MenubarItem, MenubarLabel, MenubarSubTrigger } from '../menubar';
import { NavigationMenu } from '../navigation-menu';

describe('A01 primitive branch matrix', () => {
  it('covers item defaults, slot rendering, and every media variant', () => {
    const { rerender } = render(<Item>Default</Item>);
    rerender(
      <Item asChild>
        <section>Slot</section>
      </Item>
    );
    for (const variant of ['default', 'icon', 'avatar', 'image'] as const) {
      rerender(<ItemMedia variant={variant}>{variant}</ItemMedia>);
    }
    expect(screen.getByText('image')).toBeTruthy();
  });

  it('covers breadcrumb component and separator alternatives', () => {
    const { rerender } = render(<BreadcrumbLink href="#">Link</BreadcrumbLink>);
    rerender(
      <BreadcrumbLink asChild>
        <button>Child</button>
      </BreadcrumbLink>
    );
    rerender(<BreadcrumbSeparator />);
    expect(document.querySelector('svg')).toBeTruthy();
    rerender(
      <BreadcrumbSeparator>
        <span>Custom</span>
      </BreadcrumbSeparator>
    );
    expect(screen.getByText('Custom')).toBeTruthy();
  });

  it('covers card opt-in section styles', () => {
    render(
      <>
        <CardHeader align="center" />
        <CardTitle size="base" tone="muted" />
        <CardDescription tone="primary" />
      </>
    );
    expect(document.querySelector('[data-slot="card-header"]')?.className).toContain('text-center');
  });

  it('covers OTP active and caret alternatives', () => {
    const context = (slots: any[]) => ({ slots }) as any;
    const { rerender } = render(
      <OTPInputContext.Provider
        value={context([{ char: '1', hasFakeCaret: true, isActive: true }])}
      >
        <InputOTPSlot index={0} />
      </OTPInputContext.Provider>
    );
    expect(screen.getByText('1')).toBeTruthy();
    rerender(
      <OTPInputContext.Provider
        value={context([{ char: '2', hasFakeCaret: false, isActive: false }])}
      >
        <InputOTPSlot index={0} />
      </OTPInputContext.Provider>
    );
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('uses command-dialog defaults', () => {
    render(<CommandDialog open>Commands</CommandDialog>);
    expect(screen.getByText('Commands')).toBeTruthy();
  });

  it('covers navigation menu viewport defaults and alternatives', () => {
    const { container, rerender } = render(<NavigationMenu>Menu</NavigationMenu>);
    expect(container.querySelector('[data-slot="navigation-menu-viewport"]')).toBeTruthy();
    rerender(<NavigationMenu viewport={false}>Menu</NavigationMenu>);
    expect(container.querySelector('[data-slot="navigation-menu-viewport"]')).toBeNull();
  });

  it('covers menubar inset flags and content defaults', () => {
    render(
      <>
        <MenubarSubTrigger inset>Sub</MenubarSubTrigger>
        <MenubarSubTrigger>Plain sub</MenubarSubTrigger>
        <MenubarContent />
        <MenubarItem inset>Item</MenubarItem>
        <MenubarItem>Plain item</MenubarItem>
        <MenubarLabel inset>Label</MenubarLabel>
        <MenubarLabel>Plain label</MenubarLabel>
      </>
    );
    expect(screen.getByText('Sub').className).toContain('pl-8');
  });

  it('covers field separator content alternatives', () => {
    const { rerender } = render(<FieldSeparator>Or</FieldSeparator>);
    expect(screen.getByText('Or')).toBeTruthy();
    rerender(<FieldSeparator />);
    expect(screen.queryByText('Or')).toBeNull();
  });

  it('covers calendar caption, chevrons, focused day, and single selection', () => {
    render(<Calendar captionLayout="dropdown" />);
    expect(screen.getByTestId('day-picker')).toBeTruthy();
    const Chevron = mocks.dayPickerProps.components.Chevron;
    const { rerender } = render(<Chevron orientation="left" />);
    rerender(<Chevron orientation="right" />);
    rerender(<Chevron orientation="down" />);

    const Day = mocks.dayPickerProps.components.DayButton;
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    render(
      <Day
        day={{ date: new Date(2026, 0, 1) }}
        modifiers={{
          focused: true,
          range_end: false,
          range_middle: false,
          range_start: false,
          selected: true,
        }}
      />
    );
    expect(focus).toHaveBeenCalled();
    focus.mockRestore();
  });
});
