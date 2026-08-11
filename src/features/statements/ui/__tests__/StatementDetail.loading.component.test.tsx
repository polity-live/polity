/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatementDetail } from '../StatementDetail';

vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: () => null,
}));

afterEach(() => {
  cleanup();
});

describe('StatementDetail loading state', () => {
  it('renders a page skeleton instead of visible loading text', () => {
    render(
      <StatementDetail
        model={
          {
            status: 'loading',
            labels: {
              loading: 'Loading statement',
            },
          } as any
        }
      />
    );

    expect(document.querySelector('[data-slot="entity-page-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('Loading statement')).toBeNull();
  });
});
