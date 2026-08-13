/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AmendmentPathVisualizationView } from '../AmendmentPathVisualizationView';
import { AmendmentProcessFlowView } from '../AmendmentProcessFlowView';
import { SupportConfirmationPanelView } from '../SupportConfirmationPanelView';

const labels: Record<string, string> = {
  'common.loading.pageSkeleton.entity': 'Loading page skeleton',
  'common.network.loadingNetwork': 'Loading network',
  'features.amendments.process.loading': 'Loading process',
};

const t = (key: string) => labels[key] ?? key;

afterEach(() => {
  cleanup();
});

describe('amendment loading states', () => {
  it('renders a process-shaped skeleton for amendment process loading', () => {
    render(
      <AmendmentProcessFlowView
        {...({
          t,
          user: { id: 'user-1' },
          isLoading: true,
          processSubmission: { isActive: false },
          setPendingSelection: vi.fn(),
          setSelectorOpen: vi.fn(),
        } as any)}
      />
    );

    expect(document.querySelector('[data-slot="amendment-process-flow-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('Loading process')).toBeNull();
  });

  it('renders a network skeleton while amendment path data loads', () => {
    render(
      <AmendmentPathVisualizationView
        {...({
          t,
          amendment: null,
          hasTarget: false,
          pathSegments: [],
          nodes: [],
          edges: [],
        } as any)}
      />
    );

    expect(document.querySelector('[data-slot="network-flow-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('Loading process')).toBeNull();
  });

  it('renders section skeleton rows while support confirmations load', () => {
    render(
      <SupportConfirmationPanelView
        {...({
          t,
          pendingConfirmations: [],
          selectedConfirmation: null,
          setSelectedConfirmation: vi.fn(),
          processingId: null,
          dateLocale: undefined,
          status: 'loading',
          handleConfirm: vi.fn(),
          handleDecline: vi.fn(),
        } as any)}
      />
    );

    expect(document.querySelector('[data-slot="section-skeleton"]')).toBeTruthy();
    expect(document.querySelector('.animate-spin')).toBeNull();
  });
});
