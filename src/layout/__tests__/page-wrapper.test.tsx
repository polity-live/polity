/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PageWrapper } from '../page-wrapper';

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: ({ label, className }: { label: string; className?: string }) => (
    <div data-testid="skeleton" className={className}>
      {label}
    </div>
  ),
}));

afterEach(cleanup);

describe('PageWrapper', () => {
  it('renders children with the default and custom classes', () => {
    const first = render(<PageWrapper>Default</PageWrapper>);
    expect(screen.getByText('Default').className).toBe('');
    first.unmount();

    render(<PageWrapper className="custom">Custom</PageWrapper>);
    expect(screen.getByText('Custom').className).toBe('custom');
  });

  it('renders the translated suspense fallback', () => {
    function Pending(): ReactNode {
      throw new Promise(() => undefined);
    }

    render(
      <PageWrapper className="loading">
        <Pending />
      </PageWrapper>
    );
    expect(screen.getByTestId('skeleton').textContent).toBe('loading.page');
    expect(screen.getByTestId('skeleton').className).toBe('loading');
  });
});
