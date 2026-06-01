/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SiblingMembershipModeDescription } from '../GroupRelationshipFields';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) => {
      const templates: Record<string, string> = {
        'common.network.thisGroup': 'Diese Gruppe',
        'common.network.thisGroupEmbedded': 'diese Gruppe',
        'common.network.thisGroupWithNameEmbedded': 'diese Gruppe ({{groupName}})',
        'common.unspecified': 'Unbekannt',
      };
      const template =
        templates[key] ??
        (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ??
        key;
      const params =
        typeof paramsOrFallback === 'object' && paramsOrFallback !== null ? paramsOrFallback : {};

      return Object.entries(params).reduce((result, [paramKey, value]) => {
        return result.replaceAll(`{{${paramKey}}}`, String(value ?? ''));
      }, template);
    },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SiblingMembershipModeDescription', () => {
  it('renders the elected mode with both group tags in the sentence', () => {
    render(
      <SiblingMembershipModeDescription
        siblingMembershipMode="elected"
        currentGroupName="Parlament Rosbach"
        selectedGroupName="Fraktion H1"
      />
    );

    expect(screen.getByText('Eine Gruppenrolle in')).toBeTruthy();
    expect(screen.getByText('Fraktion H1')).toBeTruthy();
    expect(screen.getByText('erzeugt die Mitgliedschaft in')).toBeTruthy();
    expect(screen.getByText('diese Gruppe (Parlament Rosbach)')).toBeTruthy();
    expect(screen.getByText('automatisch.')).toBeTruthy();
  });

  it('renders the parliament mode as an indirect membership explanation', () => {
    render(
      <SiblingMembershipModeDescription
        siblingMembershipMode="parliament"
        currentGroupName="Parlament Rosbach"
        selectedGroupName="Stadtrat Rosbach"
      />
    );

    expect(screen.getByText('Mitgliedschaft in')).toBeTruthy();
    expect(screen.getByText('wird aus Gruppen abgeleitet, die passives Wahlrecht in')).toBeTruthy();
    expect(screen.getByText('Stadtrat Rosbach')).toBeTruthy();
    expect(screen.getByText('haben.')).toBeTruthy();
  });
});
