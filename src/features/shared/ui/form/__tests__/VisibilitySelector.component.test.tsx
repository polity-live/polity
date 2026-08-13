/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { VisibilitySelector } from '../VisibilitySelector';

beforeEach(() => {
  useLanguageStore.setState({ language: 'en' });
});

afterEach(() => {
  cleanup();
  useLanguageStore.setState({ language: 'en' });
});

describe('VisibilitySelector', () => {
  it('stacks its options on mobile and keeps the desktop three-column layout', () => {
    render(<VisibilitySelector value="public" onChange={vi.fn()} />);

    const publicOption = document.querySelector<HTMLButtonElement>('[data-create-option="public"]');
    const optionGrid = publicOption?.parentElement?.parentElement;

    expect(optionGrid?.className).toContain('grid-cols-1');
    expect(optionGrid?.className).toContain('sm:grid-cols-3');
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.getByText('Authenticated')).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
  });

  it('preserves option values and reports the selected visibility', () => {
    const onChange = vi.fn();
    render(<VisibilitySelector value="public" onChange={onChange} />);

    const authenticatedOption = document.querySelector<HTMLButtonElement>(
      '[data-create-option="authenticated"]'
    );

    expect(authenticatedOption).not.toBeNull();
    if (!authenticatedOption) {
      throw new Error('Authenticated visibility option was not rendered');
    }
    fireEvent.click(authenticatedOption);
    expect(onChange).toHaveBeenCalledWith('authenticated');

    const tooltipButton = screen.getByRole('button', {
      name: 'Anyone can see this content',
    });
    fireEvent.click(tooltipButton);
    fireEvent.mouseDown(tooltipButton);
  });

  it('renders the longer German labels', () => {
    useLanguageStore.setState({ language: 'de' });

    render(<VisibilitySelector value="authenticated" onChange={vi.fn()} />);

    expect(screen.getByText('Öffentlich')).toBeTruthy();
    expect(screen.getByText('Authentifiziert')).toBeTruthy();
    expect(screen.getByText('Privat')).toBeTruthy();
  });

  it('supports a custom label without tooltip controls', () => {
    render(
      <VisibilitySelector value="private" onChange={vi.fn()} label="Audience" showTooltip={false} />
    );

    expect(screen.getByText('Audience')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(3);
  });
});
