/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('platejs/react', () => ({
  createPlatePlugin: () => ({
    configure: (config: any) => {
      return config;
    },
  }),
}));
vi.mock('@/features/shared/ui/ui-platejs/fixed-toolbar.tsx', () => ({
  FixedToolbar: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui-platejs/fixed-toolbar-buttons.tsx', () => ({
  FixedToolbarButtons: () => <span>fixed buttons</span>,
}));

import { FixedToolbarContent, FixedToolbarKit } from '../fixed-toolbar-kit';

describe('fixed toolbar kit callback', () => {
  it('renders the configured pre-editor toolbar', () => {
    expect(FixedToolbarKit).toHaveLength(1);
    render(<FixedToolbarContent />);
    expect(screen.getByText('fixed buttons')).toBeTruthy();
  });
});
