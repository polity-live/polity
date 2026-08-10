/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: { label?: string }) =>
    values?.label ? `${key}:${values.label}` : key,
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  translate: (key: string, values?: { label?: string }) =>
    values?.label ? `${key}:${values.label}` : key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/hooks/useCurrencyCatalog', () => ({
  useCurrencyCatalog: () => [
    { code: 'EUR', name: 'Euro', label: 'EUR — Euro' },
    { code: 'USD', name: 'US Dollar', label: 'USD — US Dollar' },
  ],
}));

vi.mock('@/features/shared/ui/navigation/LinkSurface.tsx', () => ({
  LinkSurface: ({ children, href, onClick }: any) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

import { MembershipButton } from '../action-buttons/MembershipButton';
import { SubscribeButton } from '../action-buttons/SubscribeButton';
import { CalendarExportButton } from '../calendar/CalendarExportButton';
import { CurrencySelect } from '../form/CurrencySelect';
import {
  FloatingNavigationButton,
  NavigationCloseButton,
  NavigationIconToggleButton,
} from '../navigation/NavigationButtons';
import { TypeaheadSelectedCard } from '../typeahead/TypeaheadSelectedCard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('shared peripheral interaction contracts', () => {
  it('forwards stable IDs and effects through membership, subscription, and export controls', () => {
    const onRequest = vi.fn();
    const onToggle = vi.fn();
    const onExport = vi.fn();
    const { container } = render(
      <>
        <MembershipButton
          data-action-id="shared.membership.request.create"
          actionType="join"
          status={null}
          isMember={false}
          hasRequested={false}
          isInvited={false}
          onRequest={onRequest}
          onLeave={vi.fn()}
          onAcceptInvitation={vi.fn()}
          isLoading={false}
        />
        <SubscribeButton
          data-action-id="shared.subscription.toggle"
          entityType="group"
          entityId="group-1"
          isSubscribed={false}
          onToggleSubscribe={onToggle}
        />
        <CalendarExportButton
          data-action-id="shared.calendar.export.download"
          onExport={onExport}
        />
      </>
    );

    for (const id of [
      'shared.membership.request.create',
      'shared.subscription.toggle',
      'shared.calendar.export.download',
    ]) {
      const control = container.querySelector<HTMLElement>(`[data-action-id="${id}"]`);
      expect(control).toBeTruthy();
      fireEvent.click(control!);
    }
    expect(onRequest).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('renders currency and navigation controls with stable accessible identities', () => {
    const onChange = vi.fn();
    const onToggle = vi.fn();
    const onExpand = vi.fn();
    const onClose = vi.fn();
    render(
      <>
        <CurrencySelect data-action-id="shared.currency.select" value="EUR" onChange={onChange} />
        <NavigationIconToggleButton
          data-action-id="shared.navigation.mode.select"
          value="list"
          currentValue="grid"
          onClick={onToggle}
          icon={Circle}
          title="List view"
          size="small"
        />
        <FloatingNavigationButton
          data-action-id="shared.navigation.panel.toggle"
          side="right"
          isExpanded={false}
          onExpand={onExpand}
          onToggleExpanded={onToggle}
          icon={<Circle />}
        />
        <NavigationCloseButton
          data-action-id="shared.navigation.panel.close"
          side="right"
          onClose={onClose}
        />
      </>
    );

    expect(document.querySelector('[data-action-id="shared.currency.select"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    const floating = document.querySelector<HTMLElement>(
      '[data-action-id="shared.navigation.panel.toggle"]'
    );
    fireEvent.mouseEnter(floating!);
    fireEvent.click(floating!);
    fireEvent.click(document.querySelector('[data-action-id="shared.navigation.panel.close"]')!);
    expect(onExpand).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('makes a selected non-link card keyboard operable and respects disabled state', () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    const item = {
      id: 'group-1',
      entityType: 'group' as const,
      label: 'Working group',
      description: 'Description',
      metadata: ['Berlin'],
      hashtags: ['democracy'],
    };
    const { container, rerender } = render(
      <TypeaheadSelectedCard item={item} variant="stacked" onClick={onClick} onRemove={onRemove} />
    );
    const card = container.querySelector<HTMLElement>('[data-slot="typeahead-selected"]');
    fireEvent.click(card!);
    fireEvent.keyDown(card!, { key: 'Enter' });
    fireEvent.keyDown(card!, { key: ' ' });
    fireEvent.keyDown(card!, { key: 'Escape' });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'features.search.removeItem:Working group',
      })
    );
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(onRemove).toHaveBeenCalledOnce();

    rerender(
      <TypeaheadSelectedCard
        item={item}
        variant="compact"
        onClick={onClick}
        onRemove={onRemove}
        disabled
      />
    );
    const disabledCard = container.querySelector<HTMLElement>('[data-slot="typeahead-selected"]');
    fireEvent.click(disabledCard!);
    fireEvent.keyDown(disabledCard!, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(3);

    rerender(<TypeaheadSelectedCard item={item} variant="stacked" onRemove={onRemove} />);
    const passiveCard = container.querySelector<HTMLElement>('[data-slot="typeahead-selected"]')!;
    expect(passiveCard.getAttribute('role')).toBeNull();
    expect(passiveCard.getAttribute('tabindex')).toBeNull();
    fireEvent.click(passiveCard);
    fireEvent.keyDown(passiveCard, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(3);
  });
});
