/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ALPHA_WARNING_VERSION } from '@/features/shared/constants';

import { AlphaWarningToastContent } from '../AlphaWarningToastContent';

describe('AlphaWarningToastContent', () => {
  it('uses the high-contrast warning foreground for its title and version', () => {
    render(<AlphaWarningToastContent title="Alpha warning" version={ALPHA_WARNING_VERSION} />);

    expect(screen.getByText('Alpha warning').className).toContain('--badge-warning-fg');
    expect(screen.getByText(ALPHA_WARNING_VERSION).className).toContain('--badge-warning-fg');
  });
});
