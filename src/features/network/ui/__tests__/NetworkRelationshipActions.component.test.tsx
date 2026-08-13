/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GroupRelationshipRightsSelector,
  GroupRelationshipTypeSelect,
} from '../GroupRelationshipFields';

vi.mock('@/features/shared/ui/form', async () => {
  const React = await import('react');
  const SelectContext = React.createContext<(value: string) => void>(() => undefined);
  return {
    FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
    FormControlSelect: ({
      children,
      onValueChange,
      ...props
    }: {
      children: ReactNode;
      onValueChange?: (value: string) => void;
    }) => (
      <SelectContext.Provider value={onValueChange ?? (() => undefined)}>
        <div {...props}>{children}</div>
      </SelectContext.Provider>
    ),
    FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    FormControlSelectItem: ({
      children,
      value,
      ...props
    }: {
      children: ReactNode;
      value: string;
    }) => {
      const onValueChange = React.useContext(SelectContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
    FormControlSelectTrigger: ({ children, ...props }: { children: ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    FormControlSelectValue: () => null,
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('network relationship stable actions', () => {
  it('changes relationship type, rights, and directions through stable selection intents', () => {
    const onTypeChange = vi.fn();
    render(
      <GroupRelationshipTypeSelect
        label="Relationship"
        value="parent"
        currentGroupName="Council"
        selectedGroupName="Chapter"
        onValueChange={onTypeChange}
      />
    );

    fireEvent.click(
      document.querySelector('[data-action-id="network.relationship-type.option.child"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="network.relationship-type.option.sibling"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="network.relationship-type.option.parent"]')!
    );
    expect(onTypeChange.mock.calls).toEqual([['child'], ['sibling'], ['parent']]);
    expect(
      document.querySelector('[data-action-id="network.relationship-type.select"]')
    ).toBeTruthy();

    cleanup();
    const onToggleRight = vi.fn();
    const onDirectionChange = vi.fn();
    render(
      <GroupRelationshipRightsSelector
        label="Rights"
        selectedRights={new Set(['informationRight'])}
        onToggleRight={onToggleRight}
        rightDirections={{ informationRight: 'current_grants_right_to_partner' }}
        onDirectionChange={onDirectionChange}
        directionOptions={
          [
            { value: 'partner_grants_right_to_current', label: 'Incoming' },
            { value: 'bidirectional', label: 'Both' },
          ] as never
        }
        currentGroupName="Council"
        selectedGroupName="Chapter"
      />
    );

    fireEvent.click(document.querySelector('[data-action-id="network.right.toggle"]')!);
    const directionOptions = document.querySelectorAll(
      '[data-action-id="network.right.direction.option"]'
    );
    fireEvent.click(directionOptions[0]!);
    fireEvent.click(directionOptions[1]!);

    expect(onToggleRight).toHaveBeenCalledWith('informationRight');
    expect(onDirectionChange.mock.calls).toEqual([
      ['informationRight', 'partner_grants_right_to_current'],
      ['informationRight', 'bidirectional'],
    ]);
    expect(
      document.querySelector('[data-action-id="network.right.direction.select"]')
    ).toBeTruthy();
  });
});
