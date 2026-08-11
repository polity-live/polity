/* @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeMarkup: (key: string) => `markup:${key}`,
  featureThemeValue: (key: string) => `value:${key}`,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  MapPanelSkeleton: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock('../CivicTimelineMapView', () => ({
  CivicTimelineMapView: (props: Record<string, any>) => {
    mocks.viewProps = props;
    return <div>Loaded map</div>;
  },
}));

import {
  averageCenter,
  CivicTimelineMap,
  getMarkerColor,
  type CivicTimelineMapModuleLoader,
} from '../CivicTimelineMap';

const base = {
  id: 'item-1',
  type: 'event',
  title: 'Assembly',
  timestamp: Date.now(),
  coordinates: { latitude: 52, longitude: 13 },
} as any;

function modules() {
  const divIcon = vi.fn((config: Record<string, any>) => ({ config }));
  return {
    reactLeafletModule: { MapContainer: vi.fn() } as any,
    leafletModule: { divIcon } as any,
    divIcon,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mocks.viewProps = undefined;
});
afterEach(cleanup);

describe('CivicTimelineMap', () => {
  it('calculates fallback and averaged centers', () => {
    expect(averageCenter([])).toEqual([51.1657, 10.4515]);
    expect(averageCenter([{ ...base, coordinates: undefined }])).toEqual([51.1657, 10.4515]);
    expect(
      averageCenter([base, { ...base, id: 'item-2', coordinates: { latitude: 54, longitude: 15 } }])
    ).toEqual([53, 14]);
  });

  it.each([
    ['vote', 'chartChartRendererDangerColor'],
    ['election', 'chartChartRendererDangerColor'],
    ['event', 'networkNetworkEdgeHelpersWarningColor'],
    ['agenda_item', 'networkNetworkEdgeHelpersWarningColor'],
    ['amendment', 'chartChartRendererAccentColor'],
    ['workflow', 'chartChartRendererAccentColor'],
    ['group', 'networkNetworkVisualHelpersSuccessColorAlpha'],
    ['statement', 'chartChartRendererInfoColor'],
    ['blog', 'chartChartRendererInfoColor'],
    ['unknown', 'networkAmendmentPathVisualizationNeutralColorBeta'],
  ] as const)('maps %s marker colors', (type, key) => {
    expect(getMarkerColor(type as any)).toBe(`value:${key}`);
  });

  it('renders the empty and loading states', () => {
    const pending = deferred<any>();
    const loader = () => pending.promise;
    const { rerender } = render(<CivicTimelineMap items={[]} loadModules={loader} />);
    expect(screen.getByText('generated.inline.1165_no_mapped_activity_yet_caf1290e')).toBeTruthy();
    rerender(<CivicTimelineMap items={[base]} loadModules={loader} />);
    expect(screen.getByText('Loading map...')).toBeTruthy();
  });

  it('loads modules, deduplicates icons, and projects active and missing selections', async () => {
    const loaded = modules();
    const loader: CivicTimelineMapModuleLoader = vi.fn().mockResolvedValue(loaded);
    const items = [base, { ...base, id: 'item-2' }, { ...base, id: 'item-3', type: 'vote' }];
    const { rerender } = render(
      <CivicTimelineMap items={items} activeItemId="item-2" loadModules={loader} />
    );
    await waitFor(() => expect(screen.getByText('Loaded map')).toBeTruthy());
    expect(mocks.viewProps?.iconsByType.size).toBe(2);
    expect(loaded.divIcon).toHaveBeenCalledTimes(3);
    expect(mocks.viewProps?.activeItem.id).toBe('item-2');
    expect(mocks.viewProps?.center).toEqual([52, 13]);
    expect(mocks.viewProps?.zoom).toBe(6);

    rerender(<CivicTimelineMap items={[base]} activeItemId="missing" loadModules={loader} />);
    expect(mocks.viewProps?.activeItem).toBeNull();
    expect(mocks.viewProps?.zoom).toBe(10);
  });

  it('renders unavailable when loading fails while mounted', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('offline'));
    render(<CivicTimelineMap items={[base]} loadModules={loader} />);
    await waitFor(() => expect(screen.getByText('Map could not be loaded.')).toBeTruthy());
  });

  it('ignores successful and failed loads after unmount', async () => {
    const success = deferred<any>();
    const successLoader = () => success.promise;
    let view = render(<CivicTimelineMap items={[base]} loadModules={successLoader} />);
    await act(async () => undefined);
    view.unmount();
    await act(async () => success.resolve(modules()));

    const failure = deferred<any>();
    const failureLoader = () => failure.promise;
    view = render(<CivicTimelineMap items={[base]} loadModules={failureLoader} />);
    await act(async () => undefined);
    view.unmount();
    await act(async () => failure.reject(new Error('offline')));
    expect(mocks.viewProps).toBeUndefined();
  });
});
