/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TypeaheadDropdown } from '../TypeaheadDropdown';

afterEach(() => {
  cleanup();
});

describe('TypeaheadDropdown loading state', () => {
  it('renders compact section skeleton rows instead of loading text', () => {
    render(
      <TypeaheadDropdown
        results={[]}
        query="ber"
        selectedIndex={0}
        onSelect={vi.fn()}
        onHoverIndex={vi.fn()}
        isLoading
      />
    );

    expect(document.querySelector('[data-slot="section-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('generated.inline.0219_loading_b04ba49f')).toBeNull();
  });
});
