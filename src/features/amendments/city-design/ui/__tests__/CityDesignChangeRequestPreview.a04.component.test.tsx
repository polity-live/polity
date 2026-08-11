/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logic/cityDesignScene', () => ({
  mountCityDesignScene: vi.fn(),
}));

import { mountCityDesignScene } from '../../logic/cityDesignScene';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  CityDesignChangeRequestPreview,
  resolveCityDesignPreviewState,
} from '../CityDesignChangeRequestPreview';

afterEach(cleanup);
beforeEach(() => {
  vi.mocked(mountCityDesignScene)
    .mockReset()
    .mockResolvedValue({ dispose: vi.fn() } as never);
});

const lamp = {
  id: 'lamp',
  type: 'street_lamp' as const,
  geometry: { kind: 'point' as const, point: { x: 0, z: 0 }, rotation: 0 },
  properties: {},
  cost: { rule: 'per_item' as const, currency: 'EUR', suggestedUnitCostMinor: 100 },
};

describe('CityDesignChangeRequestPreview A04 alternatives', () => {
  it('falls back to the first camel-case stored design and to original snapshots', () => {
    const first = createEmptyCityDesignState({ lat: 3, lon: 4, label: 'First' });
    expect(
      resolveCityDesignPreviewState(
        { id: 'cr', source_type: 'city_design_object', original_properties: { object: lamp } },
        [{ id: 'first', designState: first }]
      ).origin.label
    ).toBe('First');
    expect(
      resolveCityDesignPreviewState(
        { id: 'cr', original_properties: { designContext: { origin: { lat: 8, lon: 9 } } } },
        []
      ).origin
    ).toEqual({ lat: 8, lon: 9 });
  });

  it('omits the cost panel when values do not change', () => {
    render(
      <CityDesignChangeRequestPreview
        changeRequest={{
          id: 'same',
          original_properties: { object: lamp },
          new_properties: { object: lamp },
        }}
      />
    );
    expect(screen.queryByText('→')).toBeNull();
  });

  it('shows em dashes for the missing side of an inserted object', () => {
    render(
      <CityDesignChangeRequestPreview
        changeRequest={{ id: 'insert', change_type: 'insert', new_properties: { object: lamp } }}
      />
    );
    expect(
      screen.getByTestId('city-design-change-request-preview').textContent?.match(/—/g)
    ).toHaveLength(2);
  });

  it('shows the unavailable state when mounting fails while active', async () => {
    vi.mocked(mountCityDesignScene).mockRejectedValueOnce(new Error('no webgl'));
    render(<CityDesignChangeRequestPreview changeRequest={{ id: 'failed' }} />);
    await waitFor(() => expect(screen.getByText(/preview unavailable/i)).toBeTruthy());
  });

  it('ignores a mount failure after unmount', async () => {
    let rejectMount!: (reason: Error) => void;
    vi.mocked(mountCityDesignScene).mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectMount = reject;
      }) as never
    );
    const view = render(<CityDesignChangeRequestPreview changeRequest={{ id: 'late-failure' }} />);
    view.unmount();
    rejectMount(new Error('late WebGL failure'));
    await waitFor(() => expect(mountCityDesignScene).toHaveBeenCalled());
  });

  it('disposes a controller that resolves after unmount', async () => {
    const dispose = vi.fn();
    let resolveMount!: (value: { dispose: () => void }) => void;
    vi.mocked(mountCityDesignScene).mockReturnValueOnce(
      new Promise(resolve => {
        resolveMount = resolve;
      }) as never
    );
    const view = render(<CityDesignChangeRequestPreview changeRequest={{ id: 'late' }} />);
    view.unmount();
    resolveMount({ dispose });
    await waitFor(() => expect(dispose).toHaveBeenCalled());
  });
});
