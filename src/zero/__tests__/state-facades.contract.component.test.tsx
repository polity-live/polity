/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const token = (key: string, args: unknown) => ({ key, args });
  const query = (key: string) => vi.fn((args: unknown) => token(key, args));
  return {
    token,
    useQuery: vi.fn(),
    queries: {
      ai: { skillsByUser: query('ai.skills'), toolsByUser: query('ai.tools') },
      calendarSubscriptions: {
        byUser: query('calendar.byUser'),
        byUserAndGroup: query('calendar.byGroup'),
        byUserAndUser: query('calendar.byTargetUser'),
      },
      documents: {
        byId: query('documents.byId'),
        threads: query('documents.threads'),
        versions: query('documents.versions'),
        collaborators: query('documents.collaborators'),
      },
      accreditation: {
        accreditationsByEvent: query('accreditation.byEvent'),
        userAccreditation: query('accreditation.byUser'),
        accreditationsByAgendaItem: query('accreditation.byAgenda'),
      },
      statements: {
        byUser: query('statements.all'),
        byGroup: query('statements.byGroup'),
        byUserId: query('statements.byUser'),
        byId: query('statements.byId'),
        byIdWithDetails: query('statements.details'),
        byIdWithHashtags: query('statements.hashtags'),
        byVisibility: query('statements.visibility'),
      },
      preferences: { byUser: query('preferences.byUser') },
    },
  };
});

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { key?: string } | undefined) => mocks.useQuery(query),
}));
vi.mock('../queries', () => ({ queries: mocks.queries }));

import { useAccreditationState } from '../accreditation/useAccreditationState';
import { useAiState } from '../ai/useAiState';
import {
  useCalendarSubscriptionForGroup,
  useCalendarSubscriptionForUser,
  useCalendarSubscriptions,
} from '../calendar-subscriptions/useCalendarSubscriptionState';
import { useDocumentState } from '../documents/useDocumentState';
import { usePreferenceState } from '../preferences/usePreferenceState';
import { useStatementState } from '../statements/useStatementState';

const data = new Map<string, unknown>([
  ['ai.skills', [{ id: 'skill-1' }]],
  ['ai.tools', [{ id: 'tool-1' }]],
  ['calendar.byUser', [{ id: 'calendar-1' }]],
  ['calendar.byGroup', [{ id: 'group-subscription' }]],
  ['calendar.byTargetUser', [{ id: 'user-subscription' }]],
  ['documents.byId', [{ id: 'document-1' }]],
  ['documents.threads', [{ id: 'thread-1' }]],
  ['documents.versions', [{ id: 'version-1' }]],
  ['documents.collaborators', [{ id: 'collaborator-1' }]],
  [
    'accreditation.byEvent',
    [
      { id: 'a1', status: 'approved' },
      { id: 'a2', status: 'pending' },
    ],
  ],
  ['accreditation.byUser', { id: 'a1', status: 'approved' }],
  ['accreditation.byAgenda', [{ id: 'a1' }]],
  ['statements.all', [{ id: 'statement-all' }]],
  ['statements.byGroup', [{ id: 'statement-group' }]],
  ['statements.byUser', [{ id: 'statement-user' }]],
  ['statements.byId', { id: 'statement-1' }],
  ['statements.details', { id: 'statement-details' }],
  ['statements.hashtags', { id: 'statement-hashtags' }],
  ['statements.visibility', [{ id: 'statement-public' }]],
]);

function installResults(statuses: string[] = []) {
  let index = 0;
  mocks.useQuery.mockImplementation((query: { key?: string } | undefined) => [
    query?.key ? data.get(query.key) : undefined,
    { type: statuses[index++] ?? 'complete' },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  data.delete('preferences.byUser');
  installResults();
});

describe('Zero state facade contracts', () => {
  it('normalizes AI data and combines both loading states', () => {
    expect(renderHook(() => useAiState()).result.current).toEqual({
      skills: [{ id: 'skill-1' }],
      tools: [{ id: 'tool-1' }],
      isLoading: false,
    });
    data.delete('ai.skills');
    data.delete('ai.tools');
    installResults(['unknown', 'complete']);
    expect(renderHook(() => useAiState()).result.current).toEqual({
      skills: [],
      tools: [],
      isLoading: true,
    });
    installResults(['complete', 'unknown']);
    expect(renderHook(() => useAiState()).result.current.isLoading).toBe(true);
    data.set('ai.skills', [{ id: 'skill-1' }]);
    data.set('ai.tools', [{ id: 'tool-1' }]);
  });

  it('supports calendar lists and optional group/user focused subscriptions', () => {
    expect(renderHook(() => useCalendarSubscriptions()).result.current).toEqual({
      subscriptions: [{ id: 'calendar-1' }],
      isLoading: false,
    });
    installResults(['unknown']);
    data.delete('calendar.byUser');
    expect(renderHook(() => useCalendarSubscriptions()).result.current).toEqual({
      subscriptions: [],
      isLoading: true,
    });
    data.set('calendar.byUser', [{ id: 'calendar-1' }]);
    installResults();

    expect(renderHook(() => useCalendarSubscriptionForGroup()).result.current).toEqual({
      subscription: null,
      isSubscribed: false,
    });
    expect(renderHook(() => useCalendarSubscriptionForGroup('group-1')).result.current).toEqual({
      subscription: { id: 'group-subscription' },
      isSubscribed: true,
    });
    data.set('calendar.byGroup', []);
    expect(
      renderHook(() => useCalendarSubscriptionForGroup('group-2')).result.current.isSubscribed
    ).toBe(false);
    expect(
      renderHook(() => useCalendarSubscriptionForUser()).result.current.subscription
    ).toBeNull();
    expect(renderHook(() => useCalendarSubscriptionForUser('user-2')).result.current).toEqual({
      subscription: { id: 'user-subscription' },
      isSubscribed: true,
    });
  });

  it('enables document details selectively and accounts for every loading source', () => {
    expect(renderHook(() => useDocumentState({})).result.current).toMatchObject({
      document: undefined,
      threads: undefined,
      versions: [],
      collaborators: [],
      isLoading: false,
    });
    expect(
      renderHook(() =>
        useDocumentState({
          documentId: 'document-1',
          includeVersions: true,
          includeCollaborators: true,
        })
      ).result.current
    ).toMatchObject({
      versions: [{ id: 'version-1' }],
      collaborators: [{ id: 'collaborator-1' }],
      isLoading: false,
    });
    for (const statuses of [
      ['unknown'],
      ['complete', 'unknown'],
      ['complete', 'complete', 'unknown'],
      ['complete', 'complete', 'complete', 'unknown'],
    ]) {
      installResults(statuses);
      expect(
        renderHook(() =>
          useDocumentState({
            documentId: 'document-1',
            includeVersions: true,
            includeCollaborators: true,
          })
        ).result.current.isLoading
      ).toBe(true);
    }
  });

  it('derives accreditation counts, status, safe defaults and all loading gates', () => {
    expect(renderHook(() => useAccreditationState()).result.current).toMatchObject({
      accreditationsByEvent: [],
      userAccreditation: null,
      isAccredited: false,
      accreditationStatus: null,
      accreditedCount: 0,
      isLoading: false,
    });
    expect(
      renderHook(() =>
        useAccreditationState({ eventId: 'event-1', userId: 'user-1', agendaItemId: 'agenda-1' })
      ).result.current
    ).toMatchObject({
      isAccredited: true,
      accreditationStatus: 'approved',
      accreditedCount: 1,
      isLoading: false,
    });
    for (const statuses of [
      ['unknown'],
      ['complete', 'unknown'],
      ['complete', 'complete', 'unknown'],
    ]) {
      installResults(statuses);
      expect(
        renderHook(() =>
          useAccreditationState({ eventId: 'event-1', userId: 'user-1', agendaItemId: 'agenda-1' })
        ).result.current.isLoading
      ).toBe(true);
    }
  });

  it('enables all statement variants and observes each loading result', () => {
    expect(renderHook(() => useStatementState()).result.current.isLoading).toBe(false);
    const options = {
      id: 'statement-1',
      groupId: 'group-1',
      userId: 'user-1',
      visibility: 'public',
      includeDetails: true,
      includeHashtags: true,
    };
    expect(renderHook(() => useStatementState(options)).result.current).toMatchObject({
      statement: { id: 'statement-1' },
      statementWithDetails: { id: 'statement-details' },
      statementWithHashtags: { id: 'statement-hashtags' },
      isLoading: false,
    });
    for (let unknownIndex = 0; unknownIndex < 7; unknownIndex++) {
      installResults(
        Array.from({ length: 7 }, (_, index) => (index === unknownIndex ? 'unknown' : 'complete'))
      );
      expect(renderHook(() => useStatementState(options)).result.current.isLoading).toBe(true);
    }
  });

  it('provides preference defaults, persisted values and loading state', () => {
    expect(renderHook(() => usePreferenceState()).result.current).toMatchObject({
      createFormStyle: 'carousel',
      theme: 'system',
      appearanceThemeId: null,
      language: 'en',
      displayCurrency: 'EUR',
      navigationView: 'asButtonList',
      groupNetworkLayouts: {},
      decisionTerminalDashboard: null,
      appTutorialCompletedAt: null,
      isLoading: false,
    });
    data.set('preferences.byUser', {
      create_form_style: 'full',
      theme: 'dark',
      appearance_theme_id: 'theme-1',
      language: 'de',
      display_currency: 'USD',
      navigation_view: 'sidebar',
      group_network_layouts: { group: {} },
      decision_terminal_dashboard: { widgets: [] },
      app_tutorial_completed_at: 42,
    });
    installResults(['unknown']);
    expect(renderHook(() => usePreferenceState()).result.current).toMatchObject({
      createFormStyle: 'full',
      theme: 'dark',
      appearanceThemeId: 'theme-1',
      language: 'de',
      displayCurrency: 'USD',
      navigationView: 'sidebar',
      appTutorialCompletedAt: 42,
      isLoading: true,
    });
  });
});
