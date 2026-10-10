import { MutationFixtures } from '../mutation-fixtures';
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
  it('uses exact numeric SQL payment expectations and retained notification dismissal state', async () => {
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
    const remove = vi.spyOn(MutationFixtures.prototype, 'remove').mockResolvedValue(undefined);
    const track = vi.spyOn(MutationFixtures.prototype, 'track').mockResolvedValue(undefined);
    const expectSQL = vi.spyOn(MutationFixtures.prototype, 'expect').mockResolvedValue(undefined);
    const rows = vi
      .spyOn(MutationFixtures.prototype, 'rows')
      .mockResolvedValue([{ id: 'payment', amount: '25.0000' }]);
    for (const method of ['insert', 'trackScope', 'sealScopes', 'verifyScopesUnchanged'] as const)
      vi.spyOn(MutationFixtures.prototype, method).mockResolvedValue(undefined);
    const ctx = {
      sql: ((first: unknown) =>
        typeof first === 'string'
          ? { identifier: first }
          : Promise.resolve(
              Array.isArray(first) && first.join('').includes('from notification_setting')
                ? [{ id: 'existing-owner-settings' }]
                : []
            )) as unknown as Sql,
      id: 'actual-query-oracles',
      ownerID: 'owner',
      outsiderID: 'outsider',
      actorID: 'owner',
      actor: 'owner',
    };
    try {
      const payment = cases.find(
        entry => entry.name === 'payments.updatePayment' && entry.actor === 'owner'
      );
      const dismissal = cases.find(
        entry => entry.name === 'notifications.dismissNotification' && entry.actor === 'owner'
      );
      if (!payment || !dismissal) throw new Error('Missing reviewed case');
      const prepared = await payment.prepare(ctx);
      await expect(prepared.verify()).resolves.toBeUndefined();
      expect(expectSQL).toHaveBeenCalledWith(
        'payment',
        expect.any(String),
        expect.objectContaining({ label: 'After' })
      );
      expect(expectSQL.mock.calls[0][2]).not.toHaveProperty('amount');
      rows.mockResolvedValue([{ id: 'payment', amount: '24.0000' }]);
      await expect(prepared.verify()).rejects.toThrow('payment.amount');
      const dismissed = await dismissal.prepare(ctx);
      const args = dismissed.args as { notificationId: string };
      const stateID = track.mock.calls.find(([table]) => table === 'notification_user_state')?.[1];
      expect(stateID).toBeTypeOf('string');
      expect(
        dismissed.observe?.before({ id: args.notificationId, title: 'Before', viewer_state: [] })
      ).toBe(true);
      expect(
        dismissed.observe?.after({
          id: args.notificationId,
          title: 'Before',
          viewer_state: [{ id: stateID, dismissed_at: 1000, purged_at: null }],
        })
      ).toBe(true);
      expect(dismissed.observe?.after(null)).toBe(false);
      const preference = cases.find(
        entry => entry.name === 'preferences.update' && entry.actor === 'owner'
      );
      if (!preference) throw new Error('Missing preference update case');
      const preferencePrepared = await preference.prepare(ctx);
      const storedPreference = vi
        .mocked(MutationFixtures.prototype.insert)
        .mock.calls.find(([table]) => table === 'user_preference')?.[1];
      const jsonbPreference = {
        ...storedPreference,
        workspace_preferences: { display: {}, favorites: [] },
      };
      expect(preferencePrepared.observe?.before(jsonbPreference)).toBe(true);
      expect(
        preferencePrepared.observe?.before({
          ...jsonbPreference,
          workspace_preferences: { display: { todoView: 'kanban' }, favorites: [] },
        })
      ).toBe(false);
      expect(preferencePrepared.observe?.after({ ...jsonbPreference, theme: 'dark' })).toBe(true);
      const settings = cases.find(
        entry => entry.name === 'notifications.updateSettings' && entry.actor === 'anonymous'
      );
      if (!settings) throw new Error('Missing settings denial');
      const settingsPrepared = await settings.prepare({
        ...ctx,
        actorID: 'anon',
        actor: 'anonymous',
      });
      const settingsInsert = vi.mocked(MutationFixtures.prototype.insert);
      const insertedIndex = settingsInsert.mock.calls.findIndex(
        ([table]) => table === 'notification_setting'
      );
      expect(remove).toHaveBeenCalledWith('notification_setting', 'existing-owner-settings');
      expect(remove.mock.invocationCallOrder[0]).toBeLessThan(
        settingsInsert.mock.invocationCallOrder[insertedIndex]
      );
      const settingsRow = settingsInsert.mock.calls[insertedIndex][1];
      expect(settingsRow.user_id).toBe('owner');
      expect(settingsPrepared.observe?.before(settingsRow)).toBe(true);
      expect(settingsPrepared.observe?.after(settingsRow)).toBe(true);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  });
  it('covers anonymous theme contracts and group manager edit/publish/delete branches', () => {
    for (const operation of ['createPersonal', 'createGroup', 'updateDraft', 'publish', 'delete']) {
      expect(
        cases.some(
          entry =>
            entry.name === `appearanceThemes.${operation}` &&
            entry.actor === 'anonymous' &&
            entry.error === 'permission_denied'
        )
      ).toBe(true);
    }
    for (const operation of ['updateDraft', 'publish', 'delete']) {
      expect(
        cases.some(
          entry =>
            entry.name === `appearanceThemes.${operation}` &&
            entry.variant === 'group-authorized' &&
            entry.outcome === 'success' &&
            'query' in entry.observer &&
            entry.observer.query === 'appearanceThemes.groupEditor'
        )
      ).toBe(true);
    }
  });
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
