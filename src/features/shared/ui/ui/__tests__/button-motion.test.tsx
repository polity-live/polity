/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Button } from '../button';

afterEach(() => {
  cleanup();
});

describe('Button motion states', () => {
  it('renders loading state without replacing the reserved label', () => {
    render(
      <Button loading loadingLabel="Saving">
        Save
      </Button>
    );

    const button = screen.getByRole('button');

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.textContent).toContain('Save');
    expect(button.textContent).toContain('Saving');
  });

  it('renders success state with a stable reserved label', () => {
    render(
      <Button successState successLabel="Saved">
        Save
      </Button>
    );

    const button = screen.getByRole('button');

    expect(button.getAttribute('data-success')).toBe('true');
    expect(button.className).toContain('civic-success-settle');
    expect(button.textContent).toContain('Save');
    expect(button.textContent).toContain('Saved');
  });
});
