/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FixedToolbar } from '../fixed-toolbar';

afterEach(cleanup);

describe('FixedToolbar', () => {
  it('uses a container-bound sticky layout without requiring app navigation context', () => {
    render(
      <FixedToolbar positionMode="container" aria-label="Embedded street toolbar">
        Demo
      </FixedToolbar>
    );

    const toolbar = screen.getByRole('toolbar', { name: 'Embedded street toolbar' });
    expect(toolbar.className).toContain('sticky');
    expect(toolbar.className).toContain('top-0');
    expect(toolbar.className).not.toContain(' fixed ');
  });
});
