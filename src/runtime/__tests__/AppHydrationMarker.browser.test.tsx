import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppHydrationMarker } from '../AppHydrationMarker';

describe('AppHydrationMarker in a real browser', () => {
  it('publishes the hydration marker after React commits effects', async () => {
    render(<AppHydrationMarker />);

    await vi.waitFor(() => {
      expect(document.querySelector('[data-testid="app-hydration"]')).toMatchObject({
        dataset: expect.objectContaining({ state: 'hydrated' }),
      });
    });
  });
});
