import { describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';
import { coreMutationCases } from '../mutation-cases-core';
import { userSharedMutators } from '../../../../src/zero/users/shared-mutators';
import { commonSharedMutators } from '../../../../src/zero/common/shared-mutators';
import { preferenceSharedMutators } from '../../../../src/zero/preferences/shared-mutators';
import { calendarSubscriptionSharedMutators } from '../../../../src/zero/calendar-subscriptions/shared-mutators';
import { notificationSharedMutators } from '../../../../src/zero/notifications/shared-mutators';
import { paymentSharedMutators } from '../../../../src/zero/payments/shared-mutators';
import { pqlSharedMutators } from '../../../../src/zero/pql/shared-mutators';
import { aiSharedMutators } from '../../../../src/zero/ai/shared-mutators';
import { appearanceThemeSharedMutators } from '../../../../src/zero/appearance-themes/shared-mutators';

describe('reviewed core mutation catalog completeness', () => {
  const cases = coreMutationCases();
  const serverOnly = new Set([
    'common.createTimelineEvent',
    'notifications.createNotification',
    'payments.recordPayment',
  ]);
  const registry = {
    users: userSharedMutators,
    common: commonSharedMutators,
    preferences: preferenceSharedMutators,
    calendarSubscriptions: calendarSubscriptionSharedMutators,
    notifications: notificationSharedMutators,
    payments: paymentSharedMutators,
    pql: pqlSharedMutators,
    ai: aiSharedMutators,
    appearanceThemes: appearanceThemeSharedMutators,
  };
  it('authorized skill creation accepts the real empty-list baseline and only its own created row', async () => {
    const url = 'postgres://postgres:fixture@127.0.0.1:15625/postgres';
    for (const name of [
      'ZERO_UPSTREAM_DB',
      'E2E_DATABASE_URL',
      'DATABASE_URL',
      'SUPABASE_DB_URL',
      'STUDIO_DATABASE_URL',
      'STUDIO_TEST_DATABASE_URL',
    ])
      vi.stubEnv(name, url);
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:15624');
    vi.stubEnv('ZERO_PERFORMANCE_LAYER', 'mutations');
    try {
      const sql = ((first: unknown) =>
        typeof first === 'string' ? { identifier: first } : Promise.resolve([])) as unknown as Sql;
      const entry = cases.find(item => item.name === 'ai.createSkill' && item.actor === 'owner')!;
      const prepared = await entry.prepare({
        sql,
        id: 'regression',
        ownerID: 'owner',
        outsiderID: 'outsider',
        actorID: 'owner',
        actor: 'owner',
      });
      const args = prepared.args as { id: string };
      expect(prepared.observe!.before([])).toBe(true);
      expect(prepared.observe!.before([{ id: 'unrelated' }])).toBe(true);
      expect(prepared.observe!.after([])).toBe(false);
      expect(
        prepared.observe!.after([
          {
            id: args.id,
            user_id: 'owner',
            slug: 'benchmark-skill',
            name: 'Before',
            aliases: '',
            system_prompt: 'Answer briefly.',
            enabled: true,
          },
        ])
      ).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('covers every owned public registry name and only denies the three explicitly server-only names', () => {
    const names = Object.entries(registry).flatMap(([domain, actions]) =>
      Object.keys(actions).map(action => `${domain}.${action}`)
    );
    expect([...new Set(cases.map(entry => entry.name))].sort()).toEqual(names.sort());
    for (const name of names) {
      const own = cases.filter(entry => entry.name === name);
      expect(own.some(entry => entry.outcome === 'success')).toBe(!serverOnly.has(name));
      if (serverOnly.has(name))
        expect(
          own.every(
            entry => entry.outcome === 'server-error' && entry.error === 'permission_denied'
          )
        ).toBe(true);
    }
  });
  it('rejects missing oracle identity, duplicate variants, and fictional observers', () => {
    expect(new Set(cases.map(entry => `${entry.name}/${entry.variant}/${entry.actor}`)).size).toBe(
      cases.length
    );
    for (const entry of cases) {
      expect(JSON.parse(JSON.stringify(entry.specification))).toEqual(entry.specification);
      expect(entry.prepare).toBeTypeOf('function');
      if (entry.outcome !== 'success') expect(entry.error).toBeTruthy();
      if ('reason' in entry.observer) expect(entry.name).toBe('payments.recordPayment');
    }
  });
  it('covers outsider ownership denial and anonymous authentication on representative domains', () => {
    for (const name of [
      'ai.updateSkill',
      'pql.delete',
      'preferences.update',
      'calendarSubscriptions.unsubscribe',
      'common.deleteLink',
      'notifications.updateSettings',
      'payments.updateSubscription',
    ]) {
      expect(
        cases.some(
          entry =>
            entry.name === name && entry.actor === 'outsider' && entry.error === 'permission_denied'
        )
      ).toBe(true);
      expect(
        cases.some(
          entry =>
            entry.name === name &&
            entry.actor === 'anonymous' &&
            entry.error === 'permission_denied'
        )
      ).toBe(true);
    }
    expect(
      cases.find(entry => entry.name === 'appearanceThemes.publish' && entry.actor === 'outsider')
        ?.outcome
    ).toBe('client-error');
  });
});
