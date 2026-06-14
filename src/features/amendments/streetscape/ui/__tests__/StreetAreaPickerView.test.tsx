/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StreetAreaPickerView } from '../StreetAreaPickerView';

describe('StreetAreaPickerView', () => {
  it('renders the map fallback at double height', () => {
    render(
      <StreetAreaPickerView
        center={{ lat: 52.52, lon: 13.405 }}
        bbox={{ south: 52.51, west: 13.4, north: 52.53, east: 13.41 }}
        mapSelection={{
          center: { lat: 52.52, lon: 13.405 },
          widthMeters: 100,
          heightMeters: 100,
          rotationDeg: 0,
        }}
        isLoadingOsm={false}
        osmError={null}
        readOnly={false}
        onMapSelectionChange={vi.fn()}
        onLoadOsm={vi.fn()}
        onLoadSample={vi.fn()}
        reactLeafletModule={null}
        setReactLeafletModule={vi.fn()}
        leafletModule={null}
        setLeafletModule={vi.fn()}
        loadFailed={true}
        setLoadFailed={vi.fn()}
        markerIcon={null}
        resizeMarkerIcon={null}
        rotateMarkerIcon={null}
        position={[52.52, 13.405]}
        bounds={null}
        selectionCorners={[]}
        rotateHandlePosition={[52.52, 13.405]}
        resizeHandles={[]}
        widthMeters={100}
        heightMeters={100}
        rotationDeg={0}
        onBboxMove={vi.fn()}
        onBboxResize={vi.fn()}
        onSelectionRotate={vi.fn()}
        onWidthMetersChange={vi.fn()}
        onHeightMetersChange={vi.fn()}
        onRotationDegreesChange={vi.fn()}
        mapUnavailable={true}
      />
    );

    expect(screen.getByText('Karte konnte nicht geladen werden.').className).toContain('h-96');
  });
});
