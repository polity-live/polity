/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ActionBar, ResponsiveActionLabel } from '../ActionBar';

afterEach(cleanup);

describe('ActionBar mobile presentation', () => {
  it('provides compact spacing while retaining the desktop spacing classes', () => {
    const { container } = render(<ActionBar>Actions</ActionBar>);
    const actionBar = container.firstElementChild;

    expect(actionBar?.className).toContain('gap-1.5');
    expect(actionBar?.className).toContain('sm:gap-2');
    expect(actionBar?.className).toContain('mb-4');
    expect(actionBar?.className).toContain('sm:mb-6');
  });

  it('renders compact and full responsive labels', () => {
    render(<ResponsiveActionLabel full="Request Collaboration" compact="Collaborate" />);

    expect(screen.getByText('Collaborate').className).toContain('sm:hidden');
    expect(screen.getByText('Request Collaboration').className).toContain('hidden');
    expect(screen.getByText('Request Collaboration').className).toContain('sm:inline');
  });
});
