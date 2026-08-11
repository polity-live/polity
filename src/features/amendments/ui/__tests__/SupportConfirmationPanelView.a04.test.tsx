/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ comparisonProps: null as any }));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({ SectionSkeleton: () => <div>skeleton</div> }));
vi.mock('../VersionComparisonView.tsx', () => ({
  VersionComparisonView: (props: any) => {
    mocks.comparisonProps = props;
    return <div>comparison</div>;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { SupportConfirmationPanelView } from '../SupportConfirmationPanelView';

function props(overrides: Record<string, any> = {}) {
  return {
    groupId: 'group',
    t: (key: string) => key,
    i18n: {},
    pendingConfirmations: [],
    isLoading: false,
    confirmSupport: vi.fn(),
    declineSupport: vi.fn(),
    selectedConfirmation: null,
    setSelectedConfirmation: vi.fn(),
    processingId: null,
    setProcessingId: vi.fn(),
    dateLocale: undefined,
    status: 'empty',
    handleConfirm: vi.fn(),
    handleDecline: vi.fn(),
    ...overrides,
  } as any;
}

const confirmation = (overrides: Record<string, any> = {}) => ({
  id: 'confirmation',
  created_at: Date.now(),
  amendment: { title: 'Amendment', document: { content: 'direct content' }, documents: [] },
  ...overrides,
});

describe('SupportConfirmationPanelView A04 branch accountability', () => {
  afterEach(() => {
    cleanup();
    mocks.comparisonProps = null;
  });

  it('renders loading and empty states', () => {
    const { rerender } = render(<SupportConfirmationPanelView {...props({ status: 'loading' })} />);
    expect(screen.getByText('skeleton')).toBeTruthy();
    rerender(<SupportConfirmationPanelView {...props({ status: 'empty' })} />);
    expect(screen.getByText('features.amendments.supportConfirmation.noPending')).toBeTruthy();
  });

  it('toggles comparison, invokes actions, and disables a processing row', () => {
    const setSelectedConfirmation = vi.fn();
    const handleConfirm = vi.fn();
    const handleDecline = vi.fn();
    const ready = props({
      status: 'ready',
      pendingConfirmations: [confirmation()],
      selectedConfirmation: null,
      setSelectedConfirmation,
      processingId: null,
      handleConfirm,
      handleDecline,
    });
    const { container, rerender } = render(<SupportConfirmationPanelView {...ready} />);
    fireEvent.click(
      container.querySelector(
        '[data-action-id="amendments.support-confirmation.toggle.comparison"]'
      )!
    );
    expect(setSelectedConfirmation).toHaveBeenCalledWith('confirmation');
    fireEvent.click(
      container.querySelector('[data-action-id="amendments.support-confirmation.accept.request"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="amendments.support-confirmation.decline.request"]')!
    );
    expect(handleConfirm).toHaveBeenCalledWith('confirmation');
    expect(handleDecline).toHaveBeenCalledWith('confirmation');

    rerender(
      <SupportConfirmationPanelView
        {...ready}
        selectedConfirmation="confirmation"
        processingId="confirmation"
      />
    );
    expect(screen.getByText('comparison')).toBeTruthy();
    expect(mocks.comparisonProps.currentVersion).toBe('direct content');
    expect(
      (
        container.querySelector(
          '[data-action-id="amendments.support-confirmation.accept.request"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    fireEvent.click(
      container.querySelector(
        '[data-action-id="amendments.support-confirmation.toggle.comparison"]'
      )!
    );
    expect(setSelectedConfirmation).toHaveBeenLastCalledWith(null);
  });

  it('uses nested-document and empty-content fallbacks plus unknown titles', () => {
    const base = props({
      status: 'ready',
      selectedConfirmation: 'nested',
      pendingConfirmations: [
        confirmation({
          id: 'nested',
          amendment: { title: null, document: null, documents: [{ content: 'nested content' }] },
        }),
      ],
    });
    const { rerender } = render(<SupportConfirmationPanelView {...base} />);
    expect(mocks.comparisonProps.currentVersion).toBe('nested content');
    expect(screen.getByText('generated.inline.0026_unknown_amendment_c9e89dc8')).toBeTruthy();

    rerender(
      <SupportConfirmationPanelView
        {...base}
        selectedConfirmation="empty"
        pendingConfirmations={[
          confirmation({ id: 'empty', amendment: { title: '', document: null, documents: [] } }),
        ]}
      />
    );
    expect(mocks.comparisonProps.currentVersion).toBe('');
  });
});
