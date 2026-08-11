/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

function primitiveModule() {
  const Primitive = React.forwardRef<HTMLElement, any>(({ children, ...props }, ref) => (
    <div ref={ref as never} {...props}>
      {children}
    </div>
  ));
  Primitive.displayName = 'Primitive';
  return Object.fromEntries(
    [
      'Root',
      'Menu',
      'Group',
      'Portal',
      'Sub',
      'RadioGroup',
      'Trigger',
      'Content',
      'Item',
      'Separator',
      'Label',
      'CheckboxItem',
      'RadioItem',
      'SubContent',
      'SubTrigger',
      'Indicator',
      'Link',
      'List',
      'Viewport',
      'Close',
      'Overlay',
      'Title',
      'Description',
      'Value',
      'ScrollUpButton',
      'ScrollDownButton',
      'Track',
      'Range',
      'Thumb',
      'ItemIndicator',
    ].map(name => [name, Primitive])
  );
}

vi.mock('@radix-ui/react-menubar', primitiveModule);
vi.mock('@radix-ui/react-navigation-menu', primitiveModule);
vi.mock('@radix-ui/react-select', primitiveModule);
vi.mock('@radix-ui/react-dialog', primitiveModule);
vi.mock('@radix-ui/react-slider', () => {
  const module = primitiveModule() as any;
  module.Root = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));
  module.Root.displayName = 'SliderRoot';
  module.Track = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  module.Range = (props: any) => <span {...props} />;
  module.Thumb = (props: any) => <span {...props} />;
  return module;
});
vi.mock('react-day-picker', () => ({
  getDefaultClassNames: () => new Proxy({}, { get: () => '' }),
  DayButton: (props: any) => <button {...props} />,
  DayPicker: (props: any) => {
    props.formatters.formatMonthDropdown(new Date('2026-01-01'));
    const WeekNumber = props.components.WeekNumber;
    return <WeekNumber data-testid="week-number">1</WeekNumber>;
  },
}));
vi.mock('../overlay-portal-boundary', () => ({
  useOverlayPortalBoundary: () => ({ portalContainer: undefined }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '../breadcrumb';
import { Calendar } from '../calendar';
import { DialogClose } from '../dialog';
import { FieldContent, FieldGroup, FieldLegend, FieldSet, FieldTitle } from '../field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../input-group';
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSubContent,
  MenubarTrigger,
} from '../menubar';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '../navigation-menu';
import { SelectLabel, SelectSeparator } from '../select';
import { SheetContent, SheetFooter } from '../sheet';
import { Slider } from '../slider';

afterEach(cleanup);

describe('remaining primitive exports', () => {
  it('renders breadcrumb, field, input, dialog, slider, and calendar exports', () => {
    render(
      <>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">link</BreadcrumbLink>
              <BreadcrumbPage>page</BreadcrumbPage>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <FieldSet>
          <FieldLegend>legend</FieldLegend>
          <FieldContent>
            <FieldTitle>title</FieldTitle>
          </FieldContent>
        </FieldSet>
        <FieldGroup>group</FieldGroup>
        <InputGroup>
          <InputGroupAddon>addon</InputGroupAddon>
          <InputGroupInput aria-label="input" />
        </InputGroup>
        <DialogClose>close</DialogClose>
        <Slider defaultValue={[1, 2]} />
        <Calendar />
      </>
    );
    expect(screen.getByTestId('week-number')).toBeTruthy();
    expect(screen.getByLabelText('input')).toBeTruthy();
  });

  it('renders every remaining menu/navigation/select/sheet wrapper', () => {
    render(
      <>
        <Menubar>
          <MenubarTrigger>trigger</MenubarTrigger>
          <MenubarContent>
            <MenubarSubContent>sub</MenubarSubContent>
            <MenubarCheckboxItem>check</MenubarCheckboxItem>
            <MenubarRadioItem value="radio">radio</MenubarRadioItem>
            <MenubarSeparator />
            <MenubarShortcut>shortcut</MenubarShortcut>
          </MenubarContent>
        </Menubar>
        <NavigationMenu viewport={false}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>nav</NavigationMenuTrigger>
              <NavigationMenuContent>content</NavigationMenuContent>
              <NavigationMenuLink>link</NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
          <NavigationMenuIndicator />
        </NavigationMenu>
        <SelectLabel>label</SelectLabel>
        <SelectSeparator />
        <SheetContent>sheet</SheetContent>
        <SheetFooter>footer</SheetFooter>
      </>
    );
    expect(screen.getByText('sheet')).toBeTruthy();
  });
});
