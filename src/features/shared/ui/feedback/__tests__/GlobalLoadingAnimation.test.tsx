/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GlobalLoadingAnimation } from '../GlobalLoadingAnimation';

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => `translated:${key}` }),
  translate: (key: string) => `translated:${key}`,
}));

afterEach(() => cleanup());

describe('GlobalLoadingAnimation', () => {
  it('uses syncing as its animated default state', () => {
    render(<GlobalLoadingAnimation />);
    const status = screen.getByText('translated:loading.sync.syncing');
    expect(status.previousElementSibling?.className).toContain('bg-amber-400');
    expect(screen.getByRole('img', { name: /coffee/ })).toBeTruthy();
  });

  it.each([
    ['connecting', 'translated:loading.sync.connecting', 'bg-amber-400'],
    ['connected', 'translated:loading.sync.connected', 'bg-emerald-500'],
    ['disconnected', 'translated:loading.sync.disconnected', 'bg-red-400'],
    ['syncing', 'translated:loading.sync.syncing', 'bg-amber-400'],
  ] as const)('renders %s connection status', (connectionStatus, label, className) => {
    render(<GlobalLoadingAnimation connectionStatus={connectionStatus} />);
    const status = screen.getByText(label);
    expect(status.previousElementSibling?.className).toContain(className);
  });
});
