/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AlphaWarningToastContent } from '../AlphaWarningToastContent';

describe('AlphaWarningToastContent', () => {
  it('uses the high-contrast warning foreground for its title and version', () => {
    render(<AlphaWarningToastContent title="Alpha warning" version="0.11.1" />);

    expect(screen.getByText('Alpha warning').className).toContain('--badge-warning-fg');
    expect(screen.getByText('0.11.1').className).toContain('--badge-warning-fg');
  });
});
