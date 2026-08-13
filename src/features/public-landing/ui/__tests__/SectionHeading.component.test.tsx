/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SectionHeading } from '../PublicLandingPage';

describe('SectionHeading', () => {
  it('renders all copy with the accessible foreground token', () => {
    render(<SectionHeading eyebrow="Product" title="Participate" description="Core flows" />);

    expect(screen.getByText('Product').className).toContain('text-foreground');
    expect(screen.getByRole('heading', { name: 'Participate' })).toBeTruthy();
    expect(screen.getByText('Core flows').className).toContain('text-foreground');
    expect(screen.getByText('Core flows').className).not.toContain('/80');
  });
});
