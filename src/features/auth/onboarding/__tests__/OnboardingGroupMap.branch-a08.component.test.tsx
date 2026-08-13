/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flyTo: vi.fn(),
  getZoom: vi.fn(() => 7),
  divIcon: vi.fn((options: unknown) => ({ options })),
}));

vi.mock('leaflet', () => ({ divIcon: mocks.divIcon }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    center,
    zoom,
  }: {
    children: ReactNode;
    center: number[];
    zoom: number;
  }) => (
    <div data-testid="leaflet-map" data-center={center.join(',')} data-zoom={zoom}>
      {children}
    </div>
  ),
  Marker: ({ children, eventHandlers, position, icon }: any) => (
    <button
      data-testid="marker"
      data-position={position.join(',')}
      data-icon={icon.options.html}
      onClick={eventHandlers.click}
    >
      {children}
    </button>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Tooltip: ({ children, permanent }: { children: ReactNode; permanent: boolean }) => (
    <span data-permanent={String(permanent)}>{children}</span>
  ),
  useMap: () => ({ flyTo: mocks.flyTo, getZoom: mocks.getZoom }),
}));
vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => key,
  featureThemeMarkup: () => '<active />',
  featureThemeValue: (key: string) => key,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  MapPanelSkeleton: ({ label }: { label: string }) => <div>{label}</div>,
}));

import { OnboardingGroupMap } from '../OnboardingGroupMap';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseGroup = { member_count: 0, visibility: 'public' as const };

describe('OnboardingGroupMap', () => {
  it('renders the no-groups state', () => {
    render(<OnboardingGroupMap groups={[]} selectedGroupIds={new Set()} />);
    expect(screen.getByText('onboarding.groupStep.mapNoGroups')).toBeTruthy();
  });

  it('maps valid coordinates, skips invalid coordinates, selects icons, flies, and invokes markers', async () => {
    const onActiveGroupChange = vi.fn();
    render(
      <OnboardingGroupMap
        groups={[
          {
            ...baseGroup,
            id: 'active',
            name: 'Active',
            location: 'Berlin',
            latitude: 52,
            longitude: 13,
          },
          { ...baseGroup, id: 'selected', name: 'Selected', latitude: 50, longitude: 9 },
          { ...baseGroup, id: 'default', name: 'Default', latitude: 48, longitude: 11 },
          { ...baseGroup, id: 'nan', name: 'NaN', latitude: Number.NaN, longitude: 8 },
          { ...baseGroup, id: 'missing', name: 'Missing' },
        ]}
        activeGroupId="active"
        selectedGroupIds={new Set(['selected'])}
        onActiveGroupChange={onActiveGroupChange}
      />
    );

    await waitFor(() => expect(screen.getByTestId('leaflet-map')).toBeTruthy());
    expect(screen.getByTestId('leaflet-map').getAttribute('data-center')).toBe('50,11');
    expect(screen.getByTestId('leaflet-map').getAttribute('data-zoom')).toBe('6');
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(3);
    expect(markers.map(marker => marker.getAttribute('data-icon'))).toEqual([
      '<active />',
      expect.stringContaining('networkNetworkVisualHelpersSuccessColorAlpha'),
      expect.stringContaining('chartChartRendererInfoColorAlpha'),
    ]);
    fireEvent.click(markers[2]);
    expect(onActiveGroupChange).toHaveBeenCalledWith('default');
    await waitFor(() =>
      expect(mocks.flyTo).toHaveBeenCalledWith([52, 13], 9, {
        animate: true,
        duration: 0.35,
      })
    );
    expect(screen.getByText('Berlin')).toBeTruthy();
  });

  it('uses the fallback center, single-group zoom, optional click callback, and ignores invalid active coordinates', async () => {
    const invalid = {
      ...baseGroup,
      id: 'invalid',
      name: 'Invalid',
      latitude: Number.POSITIVE_INFINITY,
      longitude: 1,
    };
    const view = render(
      <OnboardingGroupMap groups={[invalid]} activeGroupId="invalid" selectedGroupIds={new Set()} />
    );
    await waitFor(() => expect(screen.getByTestId('leaflet-map')).toBeTruthy());
    expect(screen.getByTestId('leaflet-map').getAttribute('data-center')).toBe('51.1657,10.4515');
    expect(screen.getByTestId('leaflet-map').getAttribute('data-zoom')).toBe('10');
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    expect(mocks.flyTo).not.toHaveBeenCalled();
    view.unmount();

    render(
      <OnboardingGroupMap
        groups={[{ ...baseGroup, id: 'only', name: 'Only', latitude: 1, longitude: 2 }]}
        activeGroupId="missing"
        selectedGroupIds={new Set()}
      />
    );
    await waitFor(() => expect(screen.getByTestId('marker')).toBeTruthy());
    fireEvent.click(screen.getByTestId('marker'));
  });

  it('does not publish asynchronously loaded modules after an immediate unmount', async () => {
    const view = render(
      <OnboardingGroupMap
        groups={[{ ...baseGroup, id: 'only', name: 'Only', latitude: 1, longitude: 2 }]}
        selectedGroupIds={new Set()}
      />
    );
    view.unmount();
    await Promise.resolve();
  });
});
