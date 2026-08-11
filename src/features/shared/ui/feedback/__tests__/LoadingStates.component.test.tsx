/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import {
  AppBootLoadingState,
  InlineLoadingText,
  MapPanelSkeleton,
  PageSkeleton,
  ProfilePageSkeleton,
  SectionSkeleton,
} from '../LoadingStates';

describe('loading states', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'en' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows recovery actions after the boot timeout', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const onSignOut = vi.fn();

    render(<AppBootLoadingState onRetry={onRetry} onSignOut={onSignOut} />);

    expect(screen.getByText('Setting up your workspace...')).toBeTruthy();
    const progressbar = screen.getByRole('progressbar', { name: 'Workspace setup progress' });
    expect(progressbar).toBeTruthy();
    expect(progressbar.getAttribute('data-motion-style')).toBe('optimistic');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.getByText('Still connecting')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('uses custom boot and recovery copy with diagnostic details', () => {
    vi.useFakeTimers();
    render(
      <AppBootLoadingState
        title="Custom boot"
        description="Custom description"
        recoveryTitle="Custom recovery"
        recoveryDescription="Custom recovery description"
        details="Zero is offline"
        timeoutMs={5}
        className="custom-boot"
      />
    );

    expect(screen.getByText('Custom boot')).toBeTruthy();
    expect(screen.getByText('Custom description')).toBeTruthy();
    act(() => vi.advanceTimersByTime(5));
    expect(screen.getByText('Custom recovery')).toBeTruthy();
    expect(screen.getByText('Custom recovery description')).toBeTruthy();
    expect(screen.getByText(/Zero is offline/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders accessible skeleton states instead of spinners', () => {
    const { rerender } = render(<PageSkeleton label="Loading content shell" />);

    expect(screen.getByText('Loading content shell')).toBeTruthy();
    expect(document.querySelector('[data-slot="spinner"]')).toBeNull();
    expect(document.querySelector('[data-slot="entity-page-skeleton"]')).toBeTruthy();

    rerender(<ProfilePageSkeleton label="Loading profile shell" />);

    expect(screen.getByText('Loading profile shell')).toBeTruthy();
    expect(document.querySelector('[data-slot="profile-page-skeleton"]')).toBeTruthy();

    rerender(<PageSkeleton variant="calendar" label="Loading calendar shell" />);

    expect(screen.getByText('Loading calendar shell')).toBeTruthy();
    expect(document.querySelector('[data-slot="calendar-page-skeleton"]')).toBeTruthy();

    rerender(<PageSkeleton variant="calendar" />);
    expect(screen.getByText('Loading calendar...')).toBeTruthy();

    rerender(<PageSkeleton />);
    expect(screen.getByText('Loading content...')).toBeTruthy();

    rerender(<PageSkeleton variant="profile" />);
    expect(document.querySelector('[data-slot="profile-page-skeleton"]')).toBeTruthy();

    rerender(<PageSkeleton variant="settings" />);
    expect(document.querySelector('[data-slot="settings-page-skeleton"]')).toBeTruthy();
  });

  it('renders compact section skeleton rows for partial content loading', () => {
    render(<SectionSkeleton rows={2} density="compact" label="Loading list rows" />);

    expect(screen.getByText('Loading list rows')).toBeTruthy();
    expect(document.querySelector('[data-slot="section-skeleton"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-slot="section-skeleton"] > div')).toHaveLength(2);
  });

  it('renders an accessible map panel skeleton', () => {
    render(<MapPanelSkeleton label="Loading map shell" />);

    expect(screen.getByText('Loading map shell')).toBeTruthy();
    expect(document.querySelector('[data-slot="map-panel-skeleton"]')).toBeTruthy();
  });

  it('uses default and custom labels for partial loading primitives', () => {
    const section = render(<SectionSkeleton />);
    expect(screen.getByText('Loading section...')).toBeTruthy();
    expect(document.querySelectorAll('[data-slot="section-skeleton"] > div')).toHaveLength(3);
    expect(document.querySelector('[data-slot="section-skeleton"] > div')?.className).toContain(
      'p-4'
    );
    section.unmount();

    const map = render(<MapPanelSkeleton heightClassName="h-96" className="custom-map" />);
    expect(document.querySelector('[data-slot="map-panel-skeleton"]')?.className).toContain('h-96');
    map.unmount();

    const inline = render(<InlineLoadingText />);
    expect(screen.getByText('Loading...')).toBeTruthy();
    inline.unmount();

    render(<InlineLoadingText label="Syncing votes" className="inline-custom" />);
    expect(screen.getByText('Syncing votes').parentElement?.className).toContain('inline-custom');
  });
});
