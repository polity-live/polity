/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AppHydrationMarker } from '../AppHydrationMarker';

afterEach(cleanup);

describe('AppHydrationMarker', () => {
  it('publishes the client hydration contract after the first effect', async () => {
    render(<AppHydrationMarker />);

    const marker = await screen.findByTestId('app-hydration');
    expect(marker.getAttribute('data-state')).toBe('hydrated');
  });
});
