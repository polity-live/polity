/* @vitest-environment jsdom */

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ options: undefined as any }));
vi.mock('../../logic/cityDesignScene', () => ({
  mountCityDesignScene: vi.fn(async (options: unknown) => {
    mocks.options = options;
    return { dispose: vi.fn() };
  }),
}));

import { CityDesignChangeRequestPreview } from '../CityDesignChangeRequestPreview';

afterEach(cleanup);

describe('CityDesignChangeRequestPreview LSF scene boundary', () => {
  it('provides inert callbacks for every read-only scene interaction', async () => {
    render(<CityDesignChangeRequestPreview changeRequest={{ id: 'request-1' }} />);
    await waitFor(() => expect(mocks.options).toBeTruthy());
    mocks.options.onPointerDown({ x: 0, z: 0 });
    mocks.options.onPointerMove({ x: 0, z: 0 });
    mocks.options.onPointerHover({ x: 0, z: 0 });
    mocks.options.onObjectSelect('object-1');
    mocks.options.onOsmWaySelect('way-1');
    mocks.options.onObjectRotate('object-1', 45);
    mocks.options.onCameraPoseChange({});
  });
});
