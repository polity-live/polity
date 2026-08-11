// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const viewMocks = vi.hoisted(() => ({
  controller: vi.fn((input: unknown) => ({ ...(input as object), controlled: true })),
  fieldsProps: null as any,
  mapProps: null as any,
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  MapPanelSkeleton: ({ label }: { label: string }) => <div data-testid="skeleton">{label}</div>,
}));

vi.mock('../useGeoAddressMapController', () => ({
  useGeoAddressMapController: (input: unknown) => viewMocks.controller(input),
}));

vi.mock('@/features/shared/ui/form/GeoAddressFields', () => ({
  GeoAddressFields: (props: unknown) => {
    viewMocks.fieldsProps = props;
    return <div data-testid="address-fields" />;
  },
}));

vi.mock('@/features/shared/ui/form/GeoAddressMap', () => ({
  GeoAddressMap: (props: unknown) => {
    viewMocks.mapProps = props;
    return <div data-testid="address-map" />;
  },
}));

import { useGeoAddressFieldsController } from '../useGeoAddressFieldsController';
import { GeoAddressMapView } from '../GeoAddressMapView';
import { GeoAddressPickerView } from '../GeoAddressPickerView';

afterEach(cleanup);

const emptyValues = {
  country: '',
  region: '',
  city: '',
  post_code: '',
  street: '',
  house_number: '',
};
const textMap = {
  country: 'Country',
  region: 'Region',
  city: 'City',
  post_code: 'Postcode',
  street: 'Street',
  house_number: 'House',
};

function fieldsProps(overrides: Record<string, unknown> = {}) {
  return {
    idPrefix: 'geo',
    values: emptyValues,
    onFieldChange: vi.fn(),
    labels: textMap,
    placeholders: textMap,
    ...overrides,
  };
}

describe('useGeoAddressFieldsController', () => {
  it('emits prioritized resolutions once and resets context on request', async () => {
    const onResolvedAddress = vi.fn();
    const input = fieldsProps({ onResolvedAddress, resetContextKey: 0 });
    const hook = renderHook(current => useGeoAddressFieldsController(current as any), {
      initialProps: input,
    });
    await waitFor(() => expect(onResolvedAddress).toHaveBeenCalledWith(null, null));

    const country = { place_id: 'country' };
    act(() => hook.result.current.handleResolved('country', country));
    await waitFor(() => expect(onResolvedAddress).toHaveBeenLastCalledWith(country, 'country'));
    const callCount = onResolvedAddress.mock.calls.length;
    act(() => hook.result.current.handleResolved('country', country));
    expect(onResolvedAddress).toHaveBeenCalledTimes(callCount);

    act(() => hook.result.current.handleResolved('country', { place_id: 'country' }));
    expect(onResolvedAddress).toHaveBeenCalledTimes(callCount);
    const street = { place_id: 'street' };
    act(() => hook.result.current.handleResolved('street', street));
    await waitFor(() => expect(onResolvedAddress).toHaveBeenLastCalledWith(street, 'street'));
    const house = { place_id: 'house' };
    act(() => hook.result.current.handleResolved('house_number', house));
    await waitFor(() => expect(onResolvedAddress).toHaveBeenLastCalledWith(house, 'house_number'));
    expect(
      (hook.result.current.context as unknown as Record<string, unknown>).house_number
    ).toBeUndefined();
    const prioritizedCallCount = onResolvedAddress.mock.calls.length;
    act(() =>
      hook.result.current.handleResolved('country', { place_id: 'country-lower-priority' })
    );
    expect(onResolvedAddress).toHaveBeenCalledTimes(prioritizedCallCount);

    hook.rerender({ ...input, resetContextKey: 1 } as any);
    await waitFor(() => expect(hook.result.current.resolvedAddresses.house_number).toBeNull());
    expect(hook.result.current.context.country).toBeNull();
  });

  it('supports omitted notifications and all resolved equality combinations', () => {
    const input = fieldsProps();
    const hook = renderHook(() => useGeoAddressFieldsController(input as any));
    act(() => {
      hook.result.current.handleResolved('city', null);
      hook.result.current.handleResolved('city', { place_id: 'city-1' });
      hook.result.current.handleResolved('city', null);
      hook.result.current.handleResolved('city', { place_id: 'city-2' });
    });
    expect(hook.result.current.resolvedAddresses.city?.place_id).toBe('city-2');
  });

  it.each(['country', 'region', 'city', 'post_code', 'street', 'house_number'] as const)(
    'cascades changed %s values but ignores identical values',
    field => {
      const values = {
        country: 'DE',
        region: 'BE',
        city: 'Berlin',
        post_code: '10115',
        street: 'Main',
        house_number: '12',
      };
      const input = fieldsProps({ values });
      const hook = renderHook(() => useGeoAddressFieldsController(input as any));
      act(() => {
        for (const resolvedField of Object.keys(values) as (keyof typeof values)[]) {
          hook.result.current.handleResolved(resolvedField, { place_id: resolvedField });
        }
      });
      input.onFieldChange.mockClear();

      act(() => hook.result.current.handleFieldChange(field, values[field]));
      expect(input.onFieldChange).toHaveBeenCalledTimes(1);
      input.onFieldChange.mockClear();

      act(() => hook.result.current.handleFieldChange(field, 'changed'));
      expect(input.onFieldChange).toHaveBeenCalledWith(field, 'changed');
      expect(input.onFieldChange.mock.calls.length).toBeGreaterThan(0);
      expect(hook.result.current.resolvedAddresses[field]).toBeNull();
    }
  );

  it('keeps state identity when no cascade entry is populated', () => {
    const input = fieldsProps({ values: emptyValues });
    const hook = renderHook(() => useGeoAddressFieldsController(input as any));
    const previousContext = hook.result.current.context;
    const previousResolved = hook.result.current.resolvedAddresses;
    act(() => hook.result.current.handleFieldChange('country', 'DE'));
    expect(hook.result.current.context).toBe(previousContext);
    expect(hook.result.current.resolvedAddresses).toBe(previousResolved);
  });
});

function readyMapProps(overrides: Record<string, unknown> = {}) {
  const MapContainer = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    coordinates: null,
    onCoordinatesChange: vi.fn(),
    isBusy: false,
    loadingLabel: 'Loading',
    unavailableLabel: 'Unavailable',
    busyLabel: 'Busy',
    emptyMessage: 'Empty',
    moveHint: 'Move',
    interactive: true,
    reactLeafletModule: {},
    leafletModule: {},
    loadFailed: false,
    markerIcon: {},
    position: [1, 2],
    zoom: 3,
    MapContainer,
    Marker: (props: any) => (
      <button
        data-testid="marker"
        onClick={() =>
          props.eventHandlers?.dragend({ target: { getLatLng: () => ({ lat: 4, lng: 5 }) } })
        }
      />
    ),
    TileLayer: () => <span>tile</span>,
    MapViewportController: () => <span>viewport</span>,
    MapClickHandler: () => <span>click-handler</span>,
    ...overrides,
  };
}

describe('GeoAddressMapView', () => {
  it('renders failure and each loading prerequisite', () => {
    const failed = render(<GeoAddressMapView {...(readyMapProps({ loadFailed: true }) as any)} />);
    expect(screen.getByText('Unavailable')).toBeTruthy();
    failed.unmount();

    for (const overrides of [
      { reactLeafletModule: null },
      { leafletModule: null },
      { markerIcon: null },
      { MapContainer: null },
    ]) {
      const loading = render(<GeoAddressMapView {...(readyMapProps(overrides) as any)} />);
      expect(screen.getByTestId('skeleton')).toBeTruthy();
      loading.unmount();
    }
  });

  it('renders interactive points, drag behavior, busy state, and defaults', () => {
    const input = readyMapProps({ coordinates: { latitude: 1, longitude: 2 }, isBusy: true });
    render(<GeoAddressMapView {...(input as any)} />);
    expect(screen.getByText('click-handler')).toBeTruthy();
    expect(screen.getByText('Busy')).toBeTruthy();
    expect(screen.getByText('Move')).toBeTruthy();
    act(() => screen.getByTestId('marker').click());
    expect(input.onCoordinatesChange).toHaveBeenCalledWith({ latitude: 4, longitude: 5 });
  });

  it('renders noninteractive areas and every GeoJSON guard', () => {
    const GeoJSON = () => <span data-testid="geo-json" />;
    const shape = { geometry: { type: 'Polygon', coordinates: [] } };
    const area = render(
      <GeoAddressMapView
        {...(readyMapProps({
          coordinates: null,
          interactive: false,
          hasAreaGeometry: true,
          GeoJSON,
          shape,
          shapeKey: 'shape',
        }) as any)}
      />
    );
    expect(screen.getByTestId('geo-json')).toBeTruthy();
    expect(screen.queryByText('click-handler')).toBeNull();
    expect(screen.getByText('Move')).toBeTruthy();
    area.unmount();

    for (const overrides of [
      { hasAreaGeometry: false, GeoJSON, shape },
      { hasAreaGeometry: true, GeoJSON: undefined, shape },
      { hasAreaGeometry: true, GeoJSON, shape: { geometry: null } },
    ]) {
      const guarded = render(<GeoAddressMapView {...(readyMapProps(overrides) as any)} />);
      expect(screen.queryByTestId('geo-json')).toBeNull();
      guarded.unmount();
    }

    const staticMarker = render(
      <GeoAddressMapView
        {...(readyMapProps({
          interactive: false,
          coordinates: { latitude: 1, longitude: 2 },
        }) as any)}
      />
    );
    expect(screen.getByTestId('marker')).toBeTruthy();
    staticMarker.unmount();

    render(<GeoAddressMapView {...(readyMapProps({ interactive: false }) as any)} />);
    expect(screen.getByText('Empty')).toBeTruthy();
  });
});

describe('Geo address view adapters', () => {
  beforeEach(() => {
    viewMocks.controller.mockClear();
    viewMocks.fieldsProps = null;
    viewMocks.mapProps = null;
  });

  it.each([
    [true, false, true],
    [false, true, true],
    [false, false, false],
  ])('combines reverse=%s and boundary=%s into busy=%s', (reverse, boundary, busy) => {
    render(
      <GeoAddressPickerView
        {...({
          idPrefix: 'geo',
          values: emptyValues,
          labels: textMap,
          placeholders: textMap,
          coordinates: null,
          shape: null,
          t: (key: string) => key,
          resetContextKey: 1,
          isReverseGeocoding: reverse,
          isBoundaryLoading: boundary,
          handleResolvedAddress: vi.fn(),
          handleFieldChange: vi.fn(),
          handleMapCoordinatesChange: vi.fn(),
        } as any)}
      />
    );
    expect(viewMocks.mapProps.isBusy).toBe(busy);
    expect(viewMocks.fieldsProps.resetContextKey).toBe(1);
  });
});
