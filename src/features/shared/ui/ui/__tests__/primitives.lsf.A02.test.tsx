/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ childProps: [] as Record<string, unknown>[] }));

function primitive(name: string) {
  return React.forwardRef<HTMLElement, Record<string, unknown>>(
    ({ children, asChild: _asChild, ...props }, ref) => {
      mocks.childProps.push({ name, ...props });
      return (
        <div ref={ref as never} data-testid={name} {...props}>
          {children as React.ReactNode}
        </div>
      );
    }
  );
}

vi.mock('@radix-ui/react-context-menu', () => ({
  Root: primitive('context-root'),
  Trigger: primitive('context-trigger'),
  Group: primitive('context-group'),
  Portal: primitive('context-portal'),
  Sub: primitive('context-sub'),
  RadioGroup: primitive('context-radio-group'),
  SubTrigger: primitive('context-sub-trigger'),
  SubContent: primitive('context-sub-content'),
  Content: primitive('context-content'),
  Item: primitive('context-item'),
  CheckboxItem: primitive('context-checkbox'),
  RadioItem: primitive('context-radio'),
  Label: primitive('context-label'),
  Separator: primitive('context-separator'),
  ItemIndicator: primitive('context-indicator'),
}));
vi.mock('@radix-ui/react-dropdown-menu', () => ({
  Root: primitive('dropdown-root'),
  Portal: primitive('dropdown-portal'),
  Trigger: primitive('dropdown-trigger'),
  Content: primitive('dropdown-content'),
  Group: primitive('dropdown-group'),
  Item: primitive('dropdown-item'),
  CheckboxItem: primitive('dropdown-checkbox'),
  RadioGroup: primitive('dropdown-radio-group'),
  RadioItem: primitive('dropdown-radio'),
  Label: primitive('dropdown-label'),
  Separator: primitive('dropdown-separator'),
  Sub: primitive('dropdown-sub'),
  SubTrigger: primitive('dropdown-sub-trigger'),
  SubContent: primitive('dropdown-sub-content'),
  ItemIndicator: primitive('dropdown-indicator'),
}));
vi.mock('cmdk', () => {
  const Command = primitive('command-root') as unknown as React.ComponentType<any> &
    Record<string, unknown>;
  Object.assign(Command, {
    Input: primitive('command-input'),
    List: primitive('command-list'),
    Empty: primitive('command-empty'),
    Group: primitive('command-group'),
    Separator: primitive('command-separator'),
    Item: primitive('command-item'),
  });
  return { Command };
});
vi.mock('@/features/shared/ui/ui/dialog.tsx', () => ({
  Dialog: primitive('dialog'),
  DialogContent: primitive('dialog-content'),
  DialogDescription: primitive('dialog-description'),
  DialogHeader: primitive('dialog-header'),
  DialogTitle: primitive('dialog-title'),
}));
vi.mock('../overlay-portal-boundary', () => ({
  useOverlayPortalBoundary: () => ({ container: null }),
}));
vi.mock('input-otp', async () => {
  const ReactModule = await import('react');
  return {
    OTPInput: primitive('otp-input'),
    OTPInputContext: ReactModule.createContext({
      slots: [{ char: '7', hasFakeCaret: true, isActive: true }],
    }),
  };
});
vi.mock('@radix-ui/react-toggle', () => ({ Root: primitive('toggle') }));
vi.mock('@/features/shared/hooks/useToasterController', () => ({
  useToasterController: () => ({ theme: 'dark' }),
}));
vi.mock('../ToasterView', () => ({ ToasterView: primitive('toaster') }));

import { ButtonGroup } from '../button-group';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../command';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '../context-menu';
import { DrawerFooter } from '../drawer';
import {
  DropdownMenuPortal,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '../dropdown-menu';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '../input-otp';
import {
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from '../item';
import { Toaster } from '../sonner';
import { Table, TableBody, TableCaption, TableFooter, TableRow } from '../table';
import { Toggle } from '../toggle';
import { VisuallyHidden } from '../visually-hidden';

afterEach(cleanup);

describe('A02 primitive LSF contracts', () => {
  it('renders command and context-menu wrapper exports', () => {
    render(
      <>
        <ButtonGroup>buttons</ButtonGroup>
        <Command>command</Command>
        <CommandDialog open>dialog</CommandDialog>
        <CommandInput value="query" />
        <CommandList>list</CommandList>
        <CommandEmpty>empty</CommandEmpty>
        <CommandGroup>group</CommandGroup>
        <CommandItem>item</CommandItem>
        <CommandSeparator />
        <CommandShortcut>shortcut</CommandShortcut>
        <ContextMenu>
          <ContextMenuTrigger>trigger</ContextMenuTrigger>
          <ContextMenuGroup>group</ContextMenuGroup>
          <ContextMenuPortal>portal</ContextMenuPortal>
          <ContextMenuSub>
            <ContextMenuSubTrigger>sub trigger</ContextMenuSubTrigger>
            <ContextMenuSubContent>sub content</ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuRadioGroup>
            <ContextMenuRadioItem value="one">radio</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuContent>content</ContextMenuContent>
          <ContextMenuItem>item</ContextMenuItem>
          <ContextMenuCheckboxItem checked>checked</ContextMenuCheckboxItem>
          <ContextMenuLabel>label</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuShortcut>shortcut</ContextMenuShortcut>
        </ContextMenu>
      </>
    );
    expect(screen.getByTestId('context-root')).toBeTruthy();
    expect(screen.getByTestId('command-separator')).toBeTruthy();
  });

  it('renders remaining dropdown, item, OTP, and basic wrappers', () => {
    render(
      <>
        <DropdownMenuPortal>portal</DropdownMenuPortal>
        <DropdownMenuShortcut>shortcut</DropdownMenuShortcut>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>trigger</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>content</DropdownMenuSubContent>
        </DropdownMenuSub>
        <DrawerFooter>footer</DrawerFooter>
        <InputOTP maxLength={1}>otp</InputOTP>
        <InputOTPGroup>group</InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSeparator />
        <ItemGroup>group</ItemGroup>
        <ItemHeader>header</ItemHeader>
        <ItemContent>content</ItemContent>
        <ItemTitle>title</ItemTitle>
        <ItemDescription>description</ItemDescription>
        <ItemActions>actions</ItemActions>
        <ItemFooter>footer</ItemFooter>
        <Table>
          <TableBody>
            <TableRow>
              <td>cell</td>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <td>footer</td>
            </TableRow>
          </TableFooter>
          <TableCaption>caption</TableCaption>
        </Table>
        <Toggle>toggle</Toggle>
        <VisuallyHidden>hidden</VisuallyHidden>
        <Toaster />
      </>
    );
    expect(screen.getByText('hidden')).toBeTruthy();
    expect(screen.getByTestId('toaster')).toBeTruthy();
  });
});
