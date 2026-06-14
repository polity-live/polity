/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateFormStyle } from '@/zero/preferences/schema';

let createFormStyle: CreateFormStyle = 'carousel';
const updateFormStyle = vi.fn();

vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({
    createFormStyle,
    groupNetworkLayouts: {},
    isLoading: false,
    preference: { id: 'preference-1' },
  }),
}));

vi.mock('@/zero/preferences/usePreferenceActions', () => ({
  usePreferenceActions: () => ({
    updateFormStyle,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'pages.create.preferences.auto': 'Automatisch',
        'pages.create.preferences.carousel': 'Karussell',
        'pages.create.preferences.onePage': 'Eine Seite',
        'pages.create.group.title': 'Neue Gruppe erstellen',
      })[key] ?? key,
  }),
}));

vi.mock('@/features/timeline/hooks/useIsMobile', () => ({
  BREAKPOINTS: { lg: 1024 },
  useIsMobile: () => false,
}));

vi.mock('../CarouselFormLayout', () => ({
  CarouselFormLayout: () => <div data-testid="carousel-layout" />,
}));

vi.mock('../OnePageFormLayout', () => ({
  OnePageFormLayout: () => <div data-testid="one-page-layout" />,
}));

import { CreateFormShell } from '../CreateFormShell';
import type { CreateFormConfig } from '../../types/create-form.types';

const config: CreateFormConfig = {
  entityType: 'group',
  isSubmitting: false,
  onSubmit: vi.fn(),
  steps: [],
  title: 'pages.create.group.title',
};

describe('CreateFormShell', () => {
  beforeEach(() => {
    createFormStyle = 'carousel';
    updateFormStyle.mockClear();
  });

  it('switches to one-page layout immediately when the preference button is clicked', () => {
    render(<CreateFormShell config={config} />);

    expect(screen.queryByTestId('carousel-layout')).not.toBeNull();
    expect(screen.queryByTestId('one-page-layout')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /eine seite/i }));

    expect(screen.queryByTestId('carousel-layout')).toBeNull();
    expect(screen.queryByTestId('one-page-layout')).not.toBeNull();
    expect(updateFormStyle).toHaveBeenCalledWith('one_page');
  });
});
