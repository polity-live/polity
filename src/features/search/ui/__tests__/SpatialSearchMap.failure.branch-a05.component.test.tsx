// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-leaflet', () => {
  throw new Error('leaflet unavailable');
});

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  MapPanelSkeleton: ({ label }: any) => <div data-testid="skeleton">{label}</div>,
}));

import { SpatialSearchMap } from '../SpatialSearchMap';

describe('SpatialSearchMap failed loading', () => {
  it('renders the unavailable message when dynamic imports reject', async () => {
    render(
      <SpatialSearchMap
        items={[]}
        activeItem={null}
        center={[0, 0]}
        onBoundsChange={vi.fn()}
        onItemSelect={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('common.locationPicker.unavailable')).toBeTruthy());
  });
});
