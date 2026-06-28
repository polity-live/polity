/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { OnboardingGroupMap } from '../OnboardingGroupMap';

vi.mock('react-leaflet', () => {
  throw new Error('react-leaflet unavailable');
});

vi.mock('leaflet', () => {
  throw new Error('leaflet unavailable');
});

afterEach(() => {
  cleanup();
});

describe('OnboardingGroupMap loading states', () => {
  it('shows a map skeleton before failed map imports become an unavailable state', async () => {
    useLanguageStore.setState({ language: 'en' });

    render(
      <OnboardingGroupMap
        groups={[
          {
            id: 'group-1',
            name: 'Berlin Group',
            latitude: 52.52,
            longitude: 13.405,
          },
        ]}
        selectedGroupIds={new Set()}
      />
    );

    expect(screen.getByText('Loading map...')).toBeTruthy();
    expect(document.querySelector('[data-slot="map-panel-skeleton"]')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Map could not be loaded.')).toBeTruthy();
    });
  });
});
