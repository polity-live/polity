/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CityDesignBoundingBox,
  CityDesignLocalPoint,
  CityDesignStateV1,
} from '@/features/amendments/city-design/types';
import type { CityDesignChangeRequest } from '@/features/amendments/city-design/logic/cityDesignChangeRequests';
import { overpassStreetSceneFn } from '@/server/overpass-street-scene';
import { LandingCityDesignPreview } from '../LandingCityDesignPreview';

const captured = vi.hoisted(() => ({
  topBarPositionMode: '',
  canvasReadOnly: false,
  canVote: false,
  initialLegendOpen: true,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      if (key.endsWith('.metrics.elements')) return `${options?.count} design elements`;
      if (key.endsWith('.metrics.cost')) return `${options?.cost}`;
      if (key.endsWith('.metrics.existing')) return `${options?.count} OSM objects`;
      if (key.endsWith('.metrics.changeRequests')) return `${options?.count} change requests`;
      if (key.endsWith('.title')) return 'City Design editor';
      if (key.endsWith('.changeRequestTitle')) return 'Add trees';
      if (key.endsWith('.demoUser')) return 'Demo user';
      if (key.endsWith('.osmLive')) return 'Live from OpenStreetMap';
      if (key.endsWith('.osmStored')) return 'Stored OSM snapshot';
      return key;
    },
  }),
}));

vi.mock('@/features/amendments/city-design/ui/CityDesignTopBarView', () => ({
  CityDesignTopBarView: (props: any) => {
    captured.topBarPositionMode = props.positionMode;
    return (
      <div
        data-testid="real-street-topbar"
        data-position-mode={props.positionMode}
        data-selected-tool={props.selectedTool}
        data-interaction-mode={props.interactionMode}
      >
        <button type="button" onClick={() => props.onToolChange('tree')}>
          Select tree tool
        </button>
        <button type="button" onClick={() => props.onInteractionModeChange('place')}>
          Place mode
        </button>
        <button type="button" onClick={props.onSave} disabled={!props.isDirty}>
          Save locally
        </button>
        <button type="button" onClick={() => props.onModeChange('view')}>
          View mode
        </button>
        <button type="button" onClick={() => props.onModeChange('suggest_internal')}>
          Suggest mode
        </button>
        <button type="button" onClick={() => props.onModeChange('vote_internal')}>
          Vote mode
        </button>
        <button type="button" onClick={() => props.onAreaPickerOpenChange(true)}>
          Open area picker
        </button>
        <button
          type="button"
          onClick={() =>
            props.onOsmLayerVisibilityChange('building', !props.osmLayerVisibility.building)
          }
        >
          Toggle buildings
        </button>
        <button type="button" onClick={() => props.onObjectDelete(props.objects[0]?.id)}>
          Delete first object
        </button>
        {props.areaPickerOpen ? props.areaPickerContent : null}
      </div>
    );
  },
}));

vi.mock('@/features/amendments/city-design/ui/StreetSceneCanvasView', () => ({
  StreetSceneCanvasView: (props: {
    design: CityDesignStateV1;
    readOnly: boolean;
    canVoteOnChangeRequests: boolean;
    initialLegendOpen: boolean;
    changeRequests: CityDesignChangeRequest[];
    onPointerDown: (point: CityDesignLocalPoint) => void;
    onChangeRequestVote: (id: string, vote: 'accept') => void;
  }) => {
    captured.canvasReadOnly = props.readOnly;
    captured.canVote = props.canVoteOnChangeRequests;
    captured.initialLegendOpen = props.initialLegendOpen;
    return (
      <div
        data-testid="real-street-scene"
        data-object-count={props.design.objects.length}
        data-osm-count={props.design.osmSnapshot?.features?.length ?? 0}
        data-buildings-visible={String(props.design.osmLayerVisibility?.building)}
        data-read-only={String(props.readOnly)}
        data-change-request-count={props.changeRequests.length}
        data-first-votes-for={props.changeRequests[0]?.votes_for ?? 0}
      >
        <button type="button" onClick={() => props.onPointerDown({ x: 5, z: 5 })}>
          Place in scene
        </button>
        <button
          type="button"
          onClick={() => {
            const request = props.changeRequests[0];
            if (request) props.onChangeRequestVote(request.id, 'accept');
          }}
        >
          Vote accept
        </button>
      </div>
    );
  },
}));

vi.mock('@/features/amendments/city-design/ui/StreetAreaPicker', () => ({
  StreetAreaPicker: ({ onMapSelectionChange, onSelectionAddressChange, onLoadOsm }: any) => (
    <div data-testid="landing-area-picker">
      <button
        type="button"
        onClick={() => {
          onMapSelectionChange({
            center: { lat: 48.1372, lon: 11.5756 },
            widthMeters: 100,
            heightMeters: 80,
            rotationDeg: 0,
          });
          onSelectionAddressChange({ formatted: 'Marienplatz, München' });
        }}
      >
        Choose new area
      </button>
      <button
        type="button"
        onClick={() => {
          onMapSelectionChange({
            center: { lat: 48.1142733, lon: 11.5325083 },
            widthMeters: 360,
            heightMeters: 280,
            rotationDeg: 0,
          });
          onSelectionAddressChange({
            formatted: 'Euckenstraße 38, München',
            city: 'München',
            postCode: '81369',
            region: 'Bayern',
            country: 'Deutschland',
            street: 'Euckenstraße',
            houseNumber: '38',
          });
        }}
      >
        Choose default area
      </button>
      <button type="button" onClick={onLoadOsm}>
        Load selected OSM area
      </button>
    </div>
  ),
}));

vi.mock('@/server/overpass-street-scene', () => ({
  overpassStreetSceneFn: vi.fn(async ({ data }: { data: { bbox: CityDesignBoundingBox } }) => ({
    fetchedAt: 1,
    bbox: data.bbox,
    features: [
      {
        id: 'osm-road',
        kind: 'road',
        geometryKind: 'line',
        points: [
          { lat: data.bbox.south, lon: data.bbox.west },
          { lat: data.bbox.north, lon: data.bbox.east },
        ],
        source: 'osm',
      },
    ],
  })),
}));

beforeEach(() => {
  vi.mocked(overpassStreetSceneFn).mockClear();
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  captured.topBarPositionMode = '';
  captured.canvasReadOnly = false;
  captured.canVote = false;
  captured.initialLegendOpen = true;
});

describe('LandingCityDesignPreview', () => {
  it('renders the real workspace with stored default OSM data and no Overpass request', () => {
    render(<LandingCityDesignPreview />);
    expect(screen.getByTestId('city-design-workspace')).toBeTruthy();
    expect(screen.getByTestId('real-street-topbar').getAttribute('data-position-mode')).toBe(
      'container'
    );
    expect(captured.initialLegendOpen).toBe(false);
    expect(screen.getByTestId('real-street-scene').getAttribute('data-osm-count')).toBe('298');
    expect(screen.getByText(/Stored OSM snapshot/)).toBeTruthy();
    expect(overpassStreetSceneFn).not.toHaveBeenCalled();
  });

  it('loads another area live and restores the stored snapshot for the default area', async () => {
    render(<LandingCityDesignPreview />);

    fireEvent.click(screen.getByRole('button', { name: 'Open area picker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose new area' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load selected OSM area' }));
    await waitFor(() =>
      expect(screen.getByTestId('real-street-scene').getAttribute('data-osm-count')).toBe('1')
    );
    expect(overpassStreetSceneFn).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Live from OpenStreetMap/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save locally' }));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Save locally' }) as HTMLButtonElement).disabled
      ).toBe(true)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open area picker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose default area' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load selected OSM area' }));
    await waitFor(() =>
      expect(screen.getByTestId('real-street-scene').getAttribute('data-osm-count')).toBe('298')
    );
    expect(screen.getByText(/Stored OSM snapshot/)).toBeTruthy();
    expect(overpassStreetSceneFn).toHaveBeenCalledTimes(1);
  });

  it('uses the real editor reducer for tools, layers, and read-only modes', async () => {
    render(<LandingCityDesignPreview />);
    expect(screen.getByTestId('real-street-scene').getAttribute('data-osm-count')).toBe('298');

    fireEvent.click(screen.getByRole('button', { name: 'Select tree tool' }));
    await waitFor(() =>
      expect(screen.getByTestId('real-street-topbar').getAttribute('data-selected-tool')).toBe(
        'tree'
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Toggle buildings' }));
    expect(screen.getByTestId('real-street-scene').getAttribute('data-buildings-visible')).toBe(
      'false'
    );
    fireEvent.click(screen.getByRole('button', { name: 'View mode' }));
    expect(screen.getByTestId('real-street-scene').getAttribute('data-read-only')).toBe('true');
  });

  it('loads a new area and enables local change-request voting in vote mode', async () => {
    render(<LandingCityDesignPreview />);
    expect(screen.getByTestId('real-street-scene').getAttribute('data-osm-count')).toBe('298');
    fireEvent.click(screen.getByRole('button', { name: 'Open area picker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose new area' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load selected OSM area' }));
    await waitFor(() => expect(screen.queryByTestId('landing-area-picker')).toBeNull());
    expect(overpassStreetSceneFn).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save locally' }));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Save locally' }) as HTMLButtonElement).disabled
      ).toBe(true)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Vote mode' }));
    expect(captured.canVote).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Vote accept' }));
    expect(screen.getByTestId('real-street-scene').getAttribute('data-first-votes-for')).toBe('13');
  });

  it('turns a locally saved suggestion into a change request and restores the base design', async () => {
    render(<LandingCityDesignPreview />);
    expect(screen.getByTestId('real-street-scene').getAttribute('data-osm-count')).toBe('298');
    fireEvent.click(screen.getByRole('button', { name: 'Suggest mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete first object' }));
    expect(screen.getByTestId('real-street-scene').getAttribute('data-object-count')).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Save locally' }));
    await waitFor(() => {
      expect(screen.getByTestId('real-street-scene').getAttribute('data-object-count')).toBe('3');
      expect(
        screen.getByTestId('real-street-scene').getAttribute('data-change-request-count')
      ).toBe('2');
    });
  });
});
