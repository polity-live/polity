// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  controller: vi.fn((input: unknown) => ({ ...(input as object), controlled: true })),
  view: vi.fn((_props: unknown) => <div data-testid="map-view" />),
}));

vi.mock('../useGeoAddressMapController', () => ({
  useGeoAddressMapController: (input: unknown) => mocks.controller(input),
}));

vi.mock('../GeoAddressMapView', () => ({
  GeoAddressMapView: (props: unknown) => mocks.view(props),
}));

import { GeoAddressMap } from '../GeoAddressMap';

afterEach(cleanup);

it('forwards map defaults and explicit values through the controller and view', () => {
  const base = {
    coordinates: null,
    onCoordinatesChange: vi.fn(),
    loadingLabel: 'Loading',
    unavailableLabel: 'Unavailable',
    busyLabel: 'Busy',
    emptyMessage: 'Empty',
    moveHint: 'Move',
  };
  const first = render(<GeoAddressMap {...base} />);
  expect(mocks.controller).toHaveBeenLastCalledWith(
    expect.objectContaining({ shape: null, isBusy: false, interactive: true })
  );
  expect(mocks.view).toHaveBeenCalledWith(expect.objectContaining({ controlled: true }));
  first.unmount();

  render(<GeoAddressMap {...base} shape={{ kind: 'point' } as any} isBusy interactive={false} />);
  expect(mocks.controller).toHaveBeenLastCalledWith(
    expect.objectContaining({ shape: { kind: 'point' }, isBusy: true, interactive: false })
  );
});
