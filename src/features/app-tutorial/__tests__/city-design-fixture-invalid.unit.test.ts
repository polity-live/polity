import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/amendments/city-design/logic/cityDesignOsm', async importOriginal => {
  const original = await importOriginal<{
    normalizeCityDesignOsmSnapshot: (...args: any[]) => unknown;
  }>();
  let validationCall = true;
  return {
    ...original,
    normalizeCityDesignOsmSnapshot: (...args: any[]) => {
      if (validationCall) {
        validationCall = false;
        return original.normalizeCityDesignOsmSnapshot(...args);
      }
      return null;
    },
  };
});

import { createAppTutorialOsmSnapshot } from '../city-design-fixture';

describe('app tutorial City Design invalid fixture boundary', () => {
  it('rejects a fixture that cannot be normalized', () => {
    expect(() => createAppTutorialOsmSnapshot()).toThrow(
      'The app tutorial OSM fixture is invalid.'
    );
  });
});
