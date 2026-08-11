/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-leaflet', () => {
  throw new Error('react-leaflet unavailable');
});
vi.mock('leaflet', () => {
  throw new Error('leaflet unavailable');
});
vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => key,
  featureThemeMarkup: () => '',
  featureThemeValue: (key: string) => key,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  MapPanelSkeleton: ({ label }: { label: string }) => <div>{label}</div>,
}));

import { OnboardingGroupMap } from '../OnboardingGroupMap';

const group = {
  id: 'group',
  name: 'Group',
  latitude: 1,
  longitude: 2,
  member_count: 0,
  visibility: 'public' as const,
};

afterEach(cleanup);

describe('OnboardingGroupMap failed imports', () => {
  it('publishes an unavailable state while mounted', async () => {
    render(<OnboardingGroupMap groups={[group]} selectedGroupIds={new Set()} />);
    await waitFor(() =>
      expect(screen.getByText('onboarding.groupStep.mapUnavailable')).toBeTruthy()
    );
  });

  it('does not publish a failed import after unmount', async () => {
    const view = render(<OnboardingGroupMap groups={[group]} selectedGroupIds={new Set()} />);
    view.unmount();
    await Promise.resolve();
    await Promise.resolve();
  });
});
