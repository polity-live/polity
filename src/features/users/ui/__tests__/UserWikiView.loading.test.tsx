/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { UserWikiView } from '../UserWikiView';

describe('UserWikiView loading state', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'en' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a profile skeleton instead of Loading user text', () => {
    render(
      <UserWikiView
        page={{
          status: 'loading',
          copy: {
            loading: 'Loading profile...',
            error: 'Error loading user:',
            notFoundTitle: 'User not found',
            notFoundDescription: 'This user has not been created yet.',
            freeSupportLabel: 'Free',
            freeSupportDescription: 'Free support tier',
            message: 'Message',
          },
        }}
      />
    );

    expect(screen.getByText('Loading profile...')).toBeTruthy();
    expect(screen.queryByText('Loading user...')).toBeNull();
    expect(document.querySelector('[data-slot="profile-page-skeleton"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="spinner"]')).toBeNull();
  });
});
