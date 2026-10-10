import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { queries } from '../../../src/zero/queries';
import type { MutationCase, MutationCaseContext } from './mutation-case-types';
import { MutationFixtures, mutationFixtureID } from './mutation-fixtures';
import { groupAdminFixture, eventAdminFixture } from './mutation-governance-fixtures';
import { POLITY_THEME } from '../../../src/features/shared/appearance-theme/presets';
import { zql } from '../../../src/zero/schema';

type Fields = Record<string, unknown>;
export interface MutationRowPlan {
  table: string;
  args: Fields;
  initial?: Fields;
  expected: Fields | null;
  query: string;
  request: unknown;
  setup?: (f: MutationFixtures) => Promise<void>;
  rowID?: string;
  existing?: boolean;
  afterSetup?: (f: MutationFixtures) => Promise<void>;
  beforeInvoke?: (f: MutationFixtures) => Promise<void>;
  sqlNumericFields?: readonly string[];
  verifyAdditional?: (f: MutationFixtures, successful: boolean) => Promise<void>;
}
type Build = (ctx: MutationCaseContext, id: (label: string) => string) => MutationRowPlan;
const now = '2026-01-01T00:00:00.000Z';
const found = (data: unknown, id: string): Fields | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  if ((data as Fields).id === id) return data as Fields;
  for (const value of Object.values(data)) {
    const row = found(value, id);
    if (row) return row;
  }
  return undefined;
};
function same(row: Fields | undefined, expected: Fields | null) {
  if (expected === null) return !row;
  return (
    !!row &&
    Object.entries(expected).every(([key, value]) => {
      const observerValue =
        typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && typeof row[key] === 'number'
          ? Date.parse(value)
          : value;
      return isDeepStrictEqual(row[key], observerValue);
    })
  );
}
/** Each descriptor is an explicit reviewed input and oracle, independent of the subject. */
export function reviewedRowMutationCases(
  name: string,
  specification: ReadonlyJSONValue,
  build: Build,
  denied: 'anonymous' | 'outsider' | false = 'outsider',
  revokedBuild?: Build
): MutationCase[] {
  return [
    'owner',
    ...(denied === 'outsider' ? ['outsider', 'anonymous'] : denied ? [denied] : []),
    ...(revokedBuild ? ['revoked'] : []),
  ].map(actor => ({
    name,
    variant: actor === 'owner' ? 'authorized' : `${actor}-denied`,
    actor: actor === 'revoked' ? 'outsider' : actor,
    outcome: actor === 'owner' ? 'success' : 'server-error',
    ...(actor !== 'owner' ? { error: 'permission_denied' } : {}),
    observer: { query: (specification as { query: string }).query },
    specification:
      actor === 'revoked'
        ? {
            reviewed: specification,
            revocation:
              'Active amendment-scoped collaborator role and exact action right exist before writer preload; SQL changes only collaborator status to revoked before invocation; subject row and side-effect snapshots independently remain unchanged',
          }
        : specification,
    async prepare(ctx) {
      const id = (label: string) => mutationFixtureID(ctx.id, `${name}:${label}`);
      const plan = (actor === 'revoked' && revokedBuild ? revokedBuild : build)(ctx, id);
      const f = new MutationFixtures(ctx.sql);
      if (plan.setup) await plan.setup(f);
      const rowID = plan.rowID ?? id('row');
      if (plan.initial) await f.insert(plan.table, { id: rowID, ...plan.initial });
      else await f.track(plan.table, rowID);
      await plan.afterSetup?.(f);
      await f.sealScopes();
      const before = plan.existing
        ? Object.fromEntries(Object.keys(plan.expected ?? {}).map(key => [key, undefined]))
        : plan.initial
          ? Object.fromEntries(Object.entries(plan.initial).filter(([key]) => !key.endsWith('_at')))
          : null;
      if (plan.existing && before) {
        const baseline = (await f.rows(plan.table, rowID))[0];
        for (const key of Object.keys(before)) before[key] = baseline[key];
      }
      return {
        args: plan.args as ReadonlyJSONValue,
        ...(plan.beforeInvoke
          ? {
              requireWriterBefore: true,
              beforeInvoke: async () => {
                await plan.beforeInvoke?.(f);
                // The deliberate authority transition is the baseline for subject side effects.
                await f.sealScopes();
              },
            }
          : {}),
        observe: {
          request: plan.request,
          before: (data: unknown) => same(found(data, rowID), before),
          after: (data: unknown) =>
            same(found(data, rowID), actor === 'owner' ? plan.expected : before),
        },
        verify: async () => {
          const expected = actor === 'owner' ? plan.expected : before;
          const numericFields = plan.sqlNumericFields ?? [];
          await f.expect(
            plan.table,
            rowID,
            expected &&
              Object.fromEntries(
                Object.entries(expected).filter(([key]) => !numericFields.includes(key))
              )
          );
          if (expected && numericFields.length) {
            const [row] = await f.rows(plan.table, rowID);
            for (const field of numericFields) {
              assert.ok(
                typeof row[field] === 'number' ||
                  (typeof row[field] === 'string' &&
                    /^-?\d+(?:\.\d+)?$/.test(row[field] as string)),
                'Invalid SQL numeric representation'
              );
              assert.equal(Number(row[field]), expected[field], `${plan.table}.${field}`);
            }
          }
          if (plan.verifyAdditional) await plan.verifyAdditional(f, actor === 'owner');
          if (actor !== 'owner') await f.verifyScopesUnchanged();
        },
        restore: () => f.restore(),
        verifyRestored: () => f.verifyRestored(),
      };
    },
  }));
}
const rowCases = reviewedRowMutationCases;
const timestamps = { created_at: now, updated_at: now };
const sqlInitial = (fields: Fields) => ({ ...fields, ...timestamps });

export function coreMutationCases(): MutationCase[] {
  const cases: MutationCase[] = [];
  const add = (
    name: string,
    query: string,
    oracle: string,
    build: Build,
    denied: 'anonymous' | 'outsider' | false = 'outsider'
  ) =>
    cases.push(
      ...rowCases(
        name,
        {
          query,
          oracle,
          fixture: 'fresh UUID namespace; explicit scalar fields; owner and outsider identities',
        },
        build,
        denied
      )
    );
  const skill = {
    slug: 'benchmark-skill',
    name: 'Before',
    aliases: '',
    system_prompt: 'Answer briefly.',
    enabled: true,
  };
  for (const operation of ['createSkill', 'updateSkill', 'deleteSkill'])
    add(
      `ai.${operation}`,
      'ai.skillsByUser',
      operation === 'createSkill'
        ? 'insert owner skill with default aliases and enabled'
        : operation === 'updateSkill'
          ? 'only name changes'
          : 'owner skill removed',
      (ctx, id) => ({
        table: 'ai_skill',
        query: 'ai.skillsByUser',
        request: queries.ai.skillsByUser({}),
        args:
          operation === 'createSkill'
            ? {
                id: id('row'),
                slug: skill.slug,
                name: skill.name,
                system_prompt: skill.system_prompt,
              }
            : operation === 'updateSkill'
              ? { id: id('row'), name: 'After' }
              : { id: id('row') },
        ...(operation !== 'createSkill'
          ? { initial: sqlInitial({ ...skill, user_id: ctx.ownerID }) }
          : {}),
        expected:
          operation === 'deleteSkill'
            ? null
            : {
                ...skill,
                user_id: ctx.ownerID,
                ...(operation === 'updateSkill' ? { name: 'After' } : {}),
              },
      }),
      operation === 'createSkill' ? 'anonymous' : 'outsider'
    );
  for (const operation of ['createTool', 'updateTool'])
    add(
      `ai.${operation}`,
      'ai.toolsByUser',
      'owner tool enabled flag is independently checked',
      (ctx, id) => ({
        table: 'ai_tool',
        query: 'ai.toolsByUser',
        request: queries.ai.toolsByUser({}),
        args:
          operation === 'createTool'
            ? { id: id('row'), tool_name: 'find_my_todos' }
            : { id: id('row'), enabled: false },
        ...(operation === 'updateTool'
          ? {
              initial: sqlInitial({
                user_id: ctx.ownerID,
                tool_name: 'find_my_todos',
                enabled: true,
              }),
            }
          : {}),
        expected: {
          user_id: ctx.ownerID,
          tool_name: 'find_my_todos',
          enabled: operation === 'createTool',
        },
      }),
      operation === 'createTool' ? 'anonymous' : 'outsider'
    );
  for (const operation of ['create', 'update', 'delete'])
    add(
      `pql.${operation}`,
      'pql.byScope',
      'explicit personal filter label and owner; deletion absence',
      (ctx, id) => {
        const fields = {
          group_id: null,
          storage_key: id('scope'),
          label: 'Before',
          query: 'status = active',
          is_active: true,
        };
        return {
          table: 'pql_filter',
          query: 'pql.byScope',
          request: queries.pql.byScope({ storage_key: id('scope') }),
          args:
            operation === 'create'
              ? { id: id('row'), ...fields }
              : operation === 'update'
                ? { id: id('row'), label: 'After' }
                : { id: id('row') },
          ...(operation !== 'create'
            ? { initial: sqlInitial({ ...fields, user_id: ctx.ownerID }) }
            : {}),
          expected:
            operation === 'delete'
              ? null
              : {
                  ...fields,
                  user_id: ctx.ownerID,
                  ...(operation === 'update' ? { label: 'After' } : {}),
                },
        };
      },
      operation === 'create' ? 'anonymous' : 'outsider'
    );
  for (const operation of ['subscribe', 'update', 'unsubscribe'])
    add(
      `calendarSubscriptions.${operation}`,
      'calendarSubscriptions.byUser',
      'explicit user subscription, visibility update or deletion',
      (ctx, id) => {
        const fields = {
          target_type: 'user',
          target_user_id: ctx.ownerID,
          target_group_id: null,
          is_visible: true,
          color: '#112233',
        };
        return {
          table: 'calendar_subscription',
          query: 'calendarSubscriptions.byUser',
          request: queries.calendarSubscriptions.byUser({}),
          args:
            operation === 'subscribe'
              ? { id: id('row'), ...fields }
              : operation === 'update'
                ? { id: id('row'), is_visible: false }
                : { id: id('row') },
          ...(operation !== 'subscribe'
            ? { initial: { ...fields, user_id: ctx.ownerID, created_at: now } }
            : {}),
          expected:
            operation === 'unsubscribe'
              ? null
              : {
                  ...fields,
                  user_id: ctx.ownerID,
                  ...(operation === 'update' ? { is_visible: false } : {}),
                },
        };
      },
      operation === 'subscribe' ? 'anonymous' : 'outsider'
    );
  const preferences = {
    create_form_style: 'carousel',
    theme: 'system',
    appearance_theme_id: null,
    language: 'en',
    display_currency: 'EUR',
    navigation_view: 'asButtonList',
    group_network_layouts: {},
  };
  for (const operation of ['create', 'update', 'setWorkspaceFavorite', 'setWorkspaceDisplay'])
    add(
      `preferences.${operation}`,
      'preferences.byUser',
      'explicit preference scalar or workspace JSON result',
      (ctx, id) => {
        const favorite = { kind: 'view', href: '/todos', title: 'Tasks' };
        const workspace = {
          favorites: operation === 'setWorkspaceFavorite' ? [favorite] : [],
          display: operation === 'setWorkspaceDisplay' ? { todoView: 'kanban' } : {},
        };
        return {
          table: 'user_preference',
          query: 'preferences.byUser',
          request: queries.preferences.byUser({}),
          setup: async f => {
            for (const row of await ctx.sql`select id from user_preference where user_id = ${ctx.ownerID}`)
              await f.remove('user_preference', row.id);
          },
          args:
            operation === 'create'
              ? { id: id('row'), ...preferences }
              : operation === 'update'
                ? { id: id('row'), theme: 'dark' }
                : operation === 'setWorkspaceFavorite'
                  ? { id: id('row'), favorite, active: true }
                  : { id: id('row'), display: { todoView: 'kanban' } },
          ...(operation === 'update'
            ? {
                initial: sqlInitial({
                  ...preferences,
                  user_id: ctx.ownerID,
                  app_tutorial_completed_at: null,
                  workspace_preferences: { favorites: [], display: {} },
                }),
              }
            : {}),
          expected: {
            user_id: ctx.ownerID,
            ...preferences,
            ...(operation === 'update' ? { theme: 'dark' } : {}),
            ...(operation.startsWith('setWorkspace') ? { workspace_preferences: workspace } : {}),
          },
        };
      },
      operation === 'update' ? 'outsider' : 'anonymous'
    );
  add(
    'users.updateProfile',
    'users.current',
    'display name updates only authenticated actor profile',
    ctx => ({
      table: 'user',
      rowID: ctx.ownerID,
      existing: true,
      args: { first_name: 'Benchmark Updated' },
      expected: { first_name: 'Benchmark Updated' },
      query: 'users.current',
      request: queries.users.current({}),
      setup: async f => {
        await f.track('user', ctx.ownerID);
      },
    }),
    'anonymous'
  );
  for (const operation of ['subscribe', 'unsubscribe'])
    add(
      `common.${operation}`,
      'common.viewerSubscriptions',
      'personal subscription ownership and absence after unsubscribe',
      (ctx, id) => {
        const fields = {
          user_id: ctx.ownerID,
          group_id: null,
          amendment_id: null,
          event_id: null,
          blog_id: null,
        };
        return {
          table: 'subscriber',
          query: 'common.viewerSubscriptions',
          request: queries.common.viewerSubscriptions({}),
          args: operation === 'subscribe' ? { id: id('row'), ...fields } : { id: id('row') },
          ...(operation === 'unsubscribe'
            ? { initial: { ...fields, subscriber_id: ctx.ownerID, created_at: now } }
            : {}),
          setup: async f => {
            await f.track('user', ctx.ownerID);
          },
          expected: operation === 'subscribe' ? { ...fields, subscriber_id: ctx.ownerID } : null,
        };
      },
      operation === 'subscribe' ? 'anonymous' : 'outsider'
    );
  for (const operation of ['addHashtag', 'deleteHashtag'])
    add(
      `common.${operation}`,
      'common.allHashtags',
      'canonical hashtag tag is explicit; deletion absent',
      (_ctx, id) => ({
        table: 'hashtag',
        query: 'common.allHashtags',
        request: queries.common.allHashtags({}),
        args:
          operation === 'addHashtag'
            ? { id: id('row'), tag: `benchmark-${id('tag')}` }
            : { id: id('row') },
        ...(operation === 'deleteHashtag'
          ? { initial: { tag: `benchmark-${id('tag')}`, created_at: now } }
          : {}),
        expected: operation === 'deleteHashtag' ? null : { tag: `benchmark-${id('tag')}` },
      }),
      'anonymous'
    );
  for (const operation of ['createLink', 'deleteLink'])
    add(
      `common.${operation}`,
      'common.links',
      'self scoped link title/url or deletion',
      (ctx, id) => {
        const fields = {
          label: 'Benchmark link',
          url: 'https://example.invalid/fixture',
          user_id: ctx.ownerID,
          group_id: null,
          event_id: null,
        };
        return {
          table: 'link',
          query: 'common.links',
          request: queries.common.links({ user_id: ctx.ownerID }),
          args: operation === 'createLink' ? { id: id('row'), ...fields } : { id: id('row') },
          ...(operation === 'deleteLink' ? { initial: { ...fields, created_at: now } } : {}),
          expected: operation === 'deleteLink' ? null : fields,
        };
      }
    );
  for (const operation of ['createReaction', 'deleteReaction'])
    add(
      `common.${operation}`,
      'common.reactions',
      'owned reaction scalar fields or deletion',
      (ctx, id) => {
        const fields = {
          entity_id: ctx.ownerID,
          entity_type: 'user',
          reaction_type: 'like',
          user_id: ctx.ownerID,
          timeline_event_id: null,
        };
        return {
          table: 'reaction',
          query: 'common.reactions',
          request: queries.common.reactions({
            entity_id: ctx.ownerID,
            entity_type: 'user',
            now: 1767225600000,
          }),
          args: operation === 'createReaction' ? { id: id('row'), ...fields } : { id: id('row') },
          ...(operation === 'deleteReaction' ? { initial: { ...fields, created_at: now } } : {}),
          expected: operation === 'deleteReaction' ? null : fields,
        };
      },
      operation === 'createReaction' ? 'anonymous' : 'outsider'
    );
  for (const operation of ['createCustomer', 'updateSubscription'])
    add(
      `payments.${operation}`,
      'payments.subscriptionStatus',
      'fixture Stripe identifiers only; no Stripe API requests',
      (ctx, id) => {
        const customer = {
          user_id: ctx.ownerID,
          stripe_customer_id: `cus_fixture_${id('customer')}`,
          email: 'fixture@example.invalid',
        };
        if (operation === 'createCustomer')
          return {
            table: 'stripe_customer',
            query: 'payments.subscriptionStatus',
            request: queries.payments.subscriptionStatus({}),
            args: { id: id('row'), ...customer },
            expected: customer,
          };
        return {
          table: 'stripe_subscription',
          query: 'payments.subscriptionStatus',
          request: queries.payments.subscriptionStatus({}),
          args: { id: id('row'), status: 'active' },
          setup: async f => {
            await f.insert('stripe_customer', { id: id('customer'), ...customer, ...timestamps });
          },
          initial: {
            customer_id: id('customer'),
            stripe_subscription_id: `sub_fixture_${id('row')}`,
            status: 'trialing',
            ...timestamps,
          },
          expected: { customer_id: id('customer'), status: 'active' },
        };
      }
    );
  for (const operation of ['createPayment', 'updatePayment', 'deletePayment'])
    add(
      `payments.${operation}`,
      'payments.byUser',
      'group owner manage permission checked; explicit amount, currency, immutable endpoints',
      (ctx, id) => {
        const groupID = mutationFixtureID(ctx.id, 'core-payment-group');
        const fields = {
          amount: 12,
          currency: 'EUR',
          label: 'Before',
          type: 'expense',
          payer_user_id: ctx.ownerID,
          payer_group_id: groupID,
          receiver_user_id: null,
          receiver_group_id: null,
        };
        return {
          table: 'payment',
          sqlNumericFields: ['amount'],
          query: 'payments.byUser',
          request: queries.payments.byUser({}),
          setup: async f => {
            await groupAdminFixture(f, ctx, 'core-payment-group');
            await f.trackScope('notification', 'related_group_id', groupID);
            await f.trackScope('notification', 'recipient_group_id', groupID);
          },
          args:
            operation === 'createPayment'
              ? { id: id('row'), ...fields }
              : operation === 'updatePayment'
                ? { id: id('row'), amount: 25, label: 'After' }
                : { id: id('row') },
          ...(operation !== 'createPayment' ? { initial: { ...fields, created_at: now } } : {}),
          expected:
            operation === 'deletePayment'
              ? null
              : {
                  ...fields,
                  ...(operation === 'updatePayment' ? { amount: 25, label: 'After' } : {}),
                },
        };
      }
    );
  for (const entity of ['User', 'Group', 'Amendment', 'Event', 'Blog', 'Statement'])
    for (const prefix of ['link', 'unlink']) {
      const table = `${entity.toLowerCase()}_hashtag`;
      const foreign = `${entity.toLowerCase()}_id`;
      const query = `${entity.toLowerCase()}Hashtags`;
      add(
        `common.${prefix}${entity}Hashtag`,
        `common.${query}`,
        'scoped hashtag association only authorized owner/manager; unlink removes junction',
        (ctx, id) => {
          const parentID =
            entity === 'User'
              ? ctx.ownerID
              : entity === 'Group'
                ? mutationFixtureID(ctx.id, 'core-hashtag-group')
                : entity === 'Event'
                  ? mutationFixtureID(ctx.id, 'core-hashtag-event')
                  : id('parent');
          const fields = { [foreign]: parentID, hashtag_id: id('hashtag') };
          const request = (queries.common as unknown as Record<string, (args: Fields) => unknown>)[
            query
          ]({ [foreign]: parentID, ...(entity === 'Statement' ? { now: 1767225600000 } : {}) });
          return {
            table,
            query: `common.${query}`,
            request,
            args: prefix === 'link' ? { id: id('row'), ...fields } : { id: id('row') },
            setup: async f => {
              if (entity === 'Group') await groupAdminFixture(f, ctx, 'core-hashtag-group');
              if (entity === 'Event') await eventAdminFixture(f, ctx, 'core-hashtag-event');
              if (entity === 'Amendment')
                await f.insert('amendment', {
                  id: parentID,
                  title: 'Fixture amendment',
                  created_by_id: ctx.ownerID,
                  visibility: 'public',
                });
              if (entity === 'Statement')
                await f.insert('statement', {
                  id: parentID,
                  user_id: ctx.ownerID,
                  text: 'Fixture statement',
                  visibility: 'private',
                });
              if (entity === 'Blog') {
                await f.insert('blog', {
                  id: parentID,
                  title: 'Fixture blog',
                  visibility: 'public',
                });
                await f.insert('role', {
                  id: id('role'),
                  scope: 'blog',
                  blog_id: parentID,
                  name: 'Blog manager',
                });
                await f.insert('action_right', {
                  id: id('right'),
                  role_id: id('role'),
                  blog_id: parentID,
                  resource: 'blogs',
                  action: 'manage',
                });
                await f.insert('blog_blogger', {
                  id: id('blogger'),
                  blog_id: parentID,
                  user_id: ctx.ownerID,
                  role_id: id('role'),
                  status: 'owner',
                });
              }
              await f.insert('hashtag', { id: id('hashtag'), tag: `benchmark-${id('hashtag')}` });
            },
            ...(prefix === 'unlink' ? { initial: { ...fields, created_at: now } } : {}),
            expected: prefix === 'unlink' ? null : fields,
          };
        }
      );
    }
  for (const operation of [
    'createSettings',
    'updateSettings',
    'registerPushSubscription',
    'unregisterPushSubscription',
  ])
    add(
      `notifications.${operation}`,
      operation.includes('Settings') ? 'notifications.settings' : 'notifications.pushSubscriptions',
      'explicit owner setting JSON or inert example.invalid push endpoint',
      (ctx, id) => {
        const setting = {
          group_notifications: null,
          event_notifications: null,
          amendment_notifications: null,
          blog_notifications: null,
          todo_notifications: null,
          social_notifications: null,
          delivery_settings: { push: false },
          timeline_settings: null,
        };
        const push = {
          endpoint: `https://example.invalid/push/${id('row')}`,
          auth: null,
          p256dh: null,
          user_agent: 'benchmark-fixture',
        };
        const settings = operation.includes('Settings');
        const create = operation === 'createSettings' || operation === 'registerPushSubscription';
        const fields = settings ? setting : push;
        return {
          table: settings ? 'notification_setting' : 'push_subscription',
          setup: async f => {
            if (settings) {
              // Authentication bootstraps one settings row per user (UNIQUE user_id).
              // Track and remove only this owner's original row, then restore it exactly.
              for (const row of await ctx.sql`select id from notification_setting where user_id = ${ctx.ownerID}`)
                await f.remove('notification_setting', row.id);
            }
          },
          query: settings ? 'notifications.settings' : 'notifications.pushSubscriptions',
          request: settings
            ? queries.notifications.settings({})
            : queries.notifications.pushSubscriptions({}),
          args: create
            ? { id: id('row'), ...fields }
            : operation === 'updateSettings'
              ? { id: id('row'), delivery_settings: { push: true } }
              : { id: id('row') },
          ...(!create ? { initial: sqlInitial({ ...fields, user_id: ctx.ownerID }) } : {}),
          expected:
            operation === 'unregisterPushSubscription'
              ? null
              : {
                  ...fields,
                  user_id: ctx.ownerID,
                  ...(operation === 'updateSettings' ? { delivery_settings: { push: true } } : {}),
                },
        };
      },
      operation === 'createSettings' || operation === 'registerPushSubscription'
        ? 'anonymous'
        : 'outsider'
    );
  cases.push(...notificationStateCases(), ...themeCases(), ...serverOnlyCases());
  for (const operation of ['follow', 'unfollow'])
    add(
      `users.${operation}`,
      'users.following',
      'explicit ownership of a follow relation; self target avoids dispatch to external services',
      (ctx, id) => ({
        table: 'follow',
        query: 'users.following',
        request: queries.users.following({ userId: ctx.ownerID }),
        args:
          operation === 'follow' ? { id: id('row'), followee_id: ctx.ownerID } : { id: id('row') },
        ...(operation === 'unfollow'
          ? { initial: { follower_id: ctx.ownerID, followee_id: ctx.ownerID, created_at: now } }
          : {}),
        expected:
          operation === 'unfollow' ? null : { follower_id: ctx.ownerID, followee_id: ctx.ownerID },
        setup: async f => {
          await f.trackScope('notification', 'recipient_id', ctx.ownerID);
        },
      }),
      operation === 'follow' ? 'anonymous' : 'outsider'
    );
  cases.push(
    ...rowCases(
      'preferences.create',
      {
        query: 'preferences.byUser',
        oracle:
          'Existing user preference keeps its ID and receives new scalar fields; requested fresh ID is never inserted',
        fixture: 'explicit upsert replay',
      },
      (ctx, id) => ({
        table: 'user_preference',
        query: 'preferences.byUser',
        request: queries.preferences.byUser({}),
        args: { id: id('requested'), ...preferences, theme: 'dark' },
        setup: async f => {
          for (const row of await ctx.sql`select id from user_preference where user_id = ${ctx.ownerID}`)
            await f.remove('user_preference', row.id);
          await f.track('user_preference', id('requested'));
        },
        initial: sqlInitial({
          ...preferences,
          user_id: ctx.ownerID,
          app_tutorial_completed_at: null,
        }),
        expected: { ...preferences, user_id: ctx.ownerID, theme: 'dark' },
      }),
      'anonymous'
    ).map(entry => ({
      ...entry,
      variant: entry.actor === 'owner' ? 'existing-user-upsert' : 'anonymous-upsert-denied',
      prepare: async (ctx: MutationCaseContext) => {
        const prepared = await entry.prepare(ctx);
        const requested = mutationFixtureID(ctx.id, 'preferences.create:requested');
        const verify = prepared.verify;
        return {
          ...prepared,
          verify: async () => {
            await verify();
            assert.equal(
              (await ctx.sql`select id from user_preference where id = ${requested}`).length,
              0,
              'Preference upsert must keep existing ID'
            );
          },
        };
      },
    }))
  );
  return cases;
}

const notificationNullFields = {
  recipient_id: null,
  sender_id: null,
  title: 'Before',
  message: 'Fixture message',
  type: 'system',
  action_url: null,
  related_entity_type: null,
  on_behalf_of_entity_type: null,
  on_behalf_of_entity_id: null,
  recipient_entity_type: null,
  recipient_entity_id: null,
  related_user_id: null,
  related_group_id: null,
  related_amendment_id: null,
  related_event_id: null,
  related_blog_id: null,
  on_behalf_of_group_id: null,
  on_behalf_of_event_id: null,
  on_behalf_of_amendment_id: null,
  on_behalf_of_blog_id: null,
  recipient_group_id: null,
  recipient_event_id: null,
  recipient_amendment_id: null,
  recipient_blog_id: null,
  category: null,
};
function notificationStateID(notificationID: string, userID: string) {
  const bytes = createHash('sha256')
    .update(`notification-state:${notificationID}:${userID}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function notificationStateCases(): MutationCase[] {
  const operations = [
    'setNotificationRead',
    'setAllNotificationsRead',
    'dismissNotification',
    'restoreNotification',
    'purgeNotificationForUser',
    'markRead',
    'markAllRead',
    'delete',
    'markEntityNotificationRead',
    'markAllEntityNotificationsRead',
    'deleteEntityNotificationRead',
    'createEntityNotification',
    'updateEntityNotification',
    'deleteEntityNotificationGlobally',
    'restoreEntityNotificationGlobally',
  ];
  return operations.flatMap(operation =>
    [
      'owner',
      ...(['setAllNotificationsRead', 'markAllRead'].includes(operation)
        ? ['anonymous']
        : ['outsider', 'anonymous']),
    ].map(actor => ({
      name: `notifications.${operation}`,
      variant: actor === 'owner' ? 'authorized' : `${actor}-denied`,
      actor,
      outcome: actor === 'owner' ? 'success' : 'server-error',
      ...(actor !== 'owner' ? { error: 'permission_denied' } : {}),
      observer: { query: 'notifications.byId' },
      specification: {
        scope: 'fresh direct-recipient notification or owner-managed canonical group recipient',
        operation,
        oracle:
          'explicit read/dismiss/purge/global deletion fields and legacy-read cardinality; authorization rejection preserves baseline',
      },
      async prepare(ctx) {
        const f = new MutationFixtures(ctx.sql);
        const id = (label: string) =>
          mutationFixtureID(ctx.id, `notifications.${operation}:${label}`);
        const notificationID = id('notification');
        const stateID = notificationStateID(notificationID, ctx.ownerID);
        const entity = operation.includes('Entity');
        const groupID = mutationFixtureID(ctx.id, 'core-notification-group');
        if (entity) await groupAdminFixture(f, ctx, 'core-notification-group');
        const fields = {
          ...notificationNullFields,
          sender_id: ctx.ownerID,
          ...(entity
            ? {
                recipient_entity_type: 'group',
                recipient_entity_id: groupID,
                recipient_group_id: groupID,
              }
            : { recipient_id: ctx.ownerID }),
        };
        const create = operation === 'createEntityNotification';
        const globalRestore = operation === 'restoreEntityNotificationGlobally';
        if (create) await f.track('notification', notificationID);
        else
          await f.insert('notification', {
            id: notificationID,
            ...fields,
            is_read: false,
            deleted_at: globalRestore ? now : null,
            deleted_by_user_id: globalRestore ? ctx.ownerID : null,
          });
        if (operation === 'markAllRead' || operation === 'setAllNotificationsRead') {
          // Batch writes must not mark seeded or previously delivered notifications read.
          await f.trackScope('notification_user_state', 'user_id', ctx.ownerID);
          for (const existing of await ctx.sql`select id from notification where id <> ${notificationID}`) {
            const [state] =
              await ctx.sql`select id from notification_user_state where notification_id = ${existing.id} and user_id = ${ctx.ownerID}`;
            if (state)
              await f.update('notification_user_state', { id: state.id, dismissed_at: now });
            else
              await f.insert('notification_user_state', {
                id: notificationStateID(existing.id, ctx.ownerID),
                notification_id: existing.id,
                user_id: ctx.ownerID,
                dismissed_at: now,
              });
          }
        }
        const restore = operation === 'restoreNotification';
        const unread = operation === 'deleteEntityNotificationRead';
        if (restore || unread)
          await f.insert('notification_user_state', {
            id: stateID,
            notification_id: notificationID,
            user_id: ctx.ownerID,
            read_at: unread ? now : null,
            dismissed_at: restore ? now : null,
            purged_at: null,
          });
        else await f.track('notification_user_state', stateID);
        // Legacy entity reads use the same deterministic state ID. It is not the request ID.
        if (unread)
          await f.insert('notification_read', {
            id: stateID,
            notification_id: notificationID,
            entity_type: 'group',
            entity_id: groupID,
            read_by_user_id: ctx.ownerID,
            read_at: now,
          });
        else await f.track('notification_read', stateID);
        const readOperation = [
          'setNotificationRead',
          'setAllNotificationsRead',
          'markRead',
          'markAllRead',
          'markEntityNotificationRead',
          'markAllEntityNotificationsRead',
        ].includes(operation);
        const dismiss = ['dismissNotification', 'purgeNotificationForUser', 'delete'].includes(
          operation
        );
        const globalDelete = operation === 'deleteEntityNotificationGlobally';
        const update = operation === 'updateEntityNotification';
        const args: Fields = create
          ? { id: notificationID, ...fields }
          : operation === 'setNotificationRead'
            ? { notificationId: notificationID, read: true }
            : operation === 'setAllNotificationsRead'
              ? { scope: { kind: 'inbox' }, read: true }
              : operation === 'markEntityNotificationRead'
                ? {
                    id: id('request'),
                    notification_id: notificationID,
                    entity_type: 'group',
                    entity_id: groupID,
                  }
                : operation === 'markAllEntityNotificationsRead'
                  ? { entity_type: 'group', entity_id: groupID }
                  : unread
                    ? { id: stateID }
                    : update
                      ? { notificationId: notificationID, title: 'After' }
                      : ['markRead', 'markAllRead', 'delete'].includes(operation)
                        ? { id: notificationID }
                        : { notificationId: notificationID };
        const visibleBefore = !create && !globalRestore;
        const visibleAfter = !globalDelete;
        const expectedView = (data: unknown, after: boolean) => {
          const row = found(data, notificationID);
          if (!(after ? visibleAfter : visibleBefore)) return !row;
          if (!row || row.title !== (after && update ? 'After' : 'Before')) return false;
          if (after && dismiss) {
            const state = found(row.viewer_state, stateID);
            return (
              !!state &&
              state.dismissed_at != null &&
              (operation !== 'purgeNotificationForUser' || state.purged_at != null)
            );
          }
          if (after && readOperation && !entity) return row.is_read === true;
          if (after && (readOperation || unread || restore)) {
            const state = found(row.viewer_state, stateID);
            return (
              !!state &&
              (readOperation
                ? state.read_at != null
                : unread
                  ? state.read_at == null
                  : state.dismissed_at == null)
            );
          }
          return true;
        };
        return {
          args: args as ReadonlyJSONValue,
          observe: {
            request: queries.notifications.byId({ id: notificationID }),
            before: (data: unknown) => expectedView(data, false),
            after: (data: unknown) => expectedView(data, actor === 'owner'),
          },
          async verify() {
            if (actor !== 'owner') {
              await f.expect(
                'notification',
                notificationID,
                create
                  ? null
                  : { title: 'Before', is_read: false, deleted_at: globalRestore ? now : null }
              );
              await f.expect(
                'notification_user_state',
                stateID,
                restore || unread
                  ? { read_at: unread ? now : null, dismissed_at: restore ? now : null }
                  : null
              );
              await f.expect(
                'notification_read',
                stateID,
                unread ? { notification_id: notificationID } : null
              );
              return;
            }
            await f.expect('notification', notificationID, {
              title: update ? 'After' : 'Before',
              is_read: readOperation && !entity,
            });
            const [notification] = await f.rows('notification', notificationID);
            assert.equal(notification.deleted_at != null, globalDelete);
            if (readOperation || dismiss || restore || unread) {
              const [state] = await f.rows('notification_user_state', stateID);
              assert(state, 'Canonical notification state required');
              assert.equal(state.read_at != null, readOperation);
              assert.equal(state.dismissed_at != null, dismiss);
              assert.equal(state.purged_at != null, operation === 'purgeNotificationForUser');
            } else await f.expect('notification_user_state', stateID, null);
            if (entity && readOperation)
              await f.expect('notification_read', stateID, {
                notification_id: notificationID,
                read_by_user_id: ctx.ownerID,
              });
            else await f.expect('notification_read', stateID, null);
          },
          restore: () => f.restore(),
          verifyRestored: () => f.verifyRestored(),
        };
      },
    }))
  );
}

function serverOnlyCases(): MutationCase[] {
  return [
    'common.createTimelineEvent',
    'notifications.createNotification',
    'payments.recordPayment',
  ].flatMap(name =>
    ['owner', 'anonymous'].map(actor => ({
      name,
      variant: 'public-api-denied',
      actor,
      outcome: 'server-error',
      error: 'permission_denied',
      observer:
        name === 'payments.recordPayment'
          ? {
              reason:
                'No public query exposes stripe_payment: payments.subscriptionStatus only exposes stripe_customer and stripe_subscription. SQL checks absence and a local-only raw query verifies optimistic rollback.',
            }
          : {
              query: name.startsWith('common.') ? 'common.timelineByEntity' : 'notifications.byId',
            },
      specification: {
        restriction: 'denyPublicApiMutation',
        input: 'complete valid fixture-only schema; no live service',
        oracle: 'record absent after server rejection',
      },
      async prepare(ctx) {
        const f = new MutationFixtures(ctx.sql);
        const id = mutationFixtureID(ctx.id, `${name}:row`);
        const table = name.startsWith('common.')
          ? 'timeline_event'
          : name.startsWith('notifications.')
            ? 'notification'
            : 'stripe_payment';
        await f.track(table, id);
        let args: Fields;
        if (table === 'notification')
          args = {
            id,
            ...notificationNullFields,
            recipient_id: ctx.ownerID,
            sender_id: ctx.ownerID,
          };
        else if (table === 'stripe_payment') {
          const customerID = mutationFixtureID(ctx.id, `${name}:customer`);
          await f.insert('stripe_customer', {
            id: customerID,
            user_id: ctx.ownerID,
            stripe_customer_id: `cus_fixture_${customerID}`,
          });
          args = {
            id,
            customer_id: customerID,
            stripe_invoice_id: `in_fixture_${id}`,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            amount: 12,
            currency: 'EUR',
            status: 'paid',
            paid_at: null,
          };
        } else
          args = {
            id,
            event_type: 'fixture',
            entity_type: 'user',
            entity_id: ctx.ownerID,
            title: 'Fixture timeline',
            description: null,
            metadata: null,
            image_url: null,
            video_url: null,
            video_thumbnail_url: null,
            content_type: null,
            tags: null,
            stats: null,
            vote_status: null,
            election_status: null,
            ends_at: null,
            user_id: ctx.ownerID,
            group_id: null,
            amendment_id: null,
            event_id: null,
            todo_id: null,
            blog_id: null,
            statement_id: null,
            actor_id: ctx.ownerID,
            election_id: null,
            amendment_vote_id: null,
          };
        return {
          args: args as ReadonlyJSONValue,
          ...(table !== 'stripe_payment'
            ? {
                observe: {
                  request:
                    table === 'notification'
                      ? queries.notifications.byId({ id })
                      : queries.common.timelineByEntity({
                          entity_type: 'user',
                          entity_id: ctx.ownerID,
                          now: 1767225600000,
                        }),
                  before: (data: unknown) => !found(data, id),
                  after: (data: unknown) => !found(data, id),
                },
              }
            : {
                verifyRollback: async (writer: unknown) => {
                  const rows = await (
                    writer as {
                      run: (request: unknown, options: { type: 'unknown' }) => Promise<unknown>;
                    }
                  ).run(zql.stripe_payment.where('id', id), { type: 'unknown' });
                  assert(
                    !found(rows, id),
                    'Server-only Stripe payment optimistic insert must roll back'
                  );
                },
              }),
          verify: () => f.expect(table, id, null),
          restore: () => f.restore(),
          verifyRestored: () => f.verifyRestored(),
        };
      },
    }))
  );
}

function themeCases(): MutationCase[] {
  const operations = ['createPersonal', 'createGroup', 'updateDraft', 'publish', 'delete'];
  return operations.flatMap(operation =>
    (['updateDraft', 'publish', 'delete'].includes(operation)
      ? [false, true]
      : [operation === 'createGroup']
    ).flatMap(group =>
      [
        'owner',
        ...(operation === 'createGroup'
          ? ['outsider', 'anonymous']
          : ['updateDraft', 'publish', 'delete'].includes(operation)
            ? ['outsider', 'anonymous']
            : ['anonymous']),
      ].map(actor => ({
        name: `appearanceThemes.${operation}`,
        variant: `${group && operation !== 'createGroup' ? 'group-' : ''}${actor === 'owner' ? 'authorized' : `${actor}-denied`}`,
        actor,
        outcome:
          actor === 'owner'
            ? 'success'
            : operation.startsWith('create')
              ? 'server-error'
              : 'client-error',
        ...(actor !== 'owner'
          ? {
              error: operation.startsWith('create')
                ? 'permission_denied'
                : 'mutation_server_failed',
            }
          : {}),
        observer: {
          query: group ? 'appearanceThemes.groupEditor' : 'appearanceThemes.personalEditor',
        },
        specification: {
          operation,
          kind: group ? 'group' : 'personal',
          anonymousContract:
            'Creation requires server authentication; editor-restricted unreadable themes reject locally before any write',
          palette: 'literal existing POLITY_THEME builtin palette and fonts',
          oracle: 'theme and draft/published revision fields independently checked',
          authorization:
            operation === 'createPersonal'
              ? 'authenticated personal creator identity'
              : 'creator edit or group owner manage',
          ...(actor !== 'owner' && !operation.startsWith('create')
            ? {
                rejection:
                  'personalEditor restricts creator identity and groupEditor requires group management; requireEditTheme rejects the unreadable client row with exact Theme not found before any write',
              }
            : {}),
        },
        async prepare(ctx) {
          const f = new MutationFixtures(ctx.sql);
          const id = (label: string) =>
            mutationFixtureID(ctx.id, `appearanceThemes.${operation}:${label}`);
          const create = operation.startsWith('create');
          const groupID = group ? await groupAdminFixture(f, ctx, 'core-theme-group') : null;
          const fields = {
            slug: `fixture-${id('theme')}`,
            name: 'Before',
            description: null,
            kind: group ? 'group' : 'personal',
            group_id: groupID,
            created_by_id: ctx.ownerID,
            current_revision_id: null,
          };
          const revision = {
            theme_id: id('theme'),
            version: 1,
            status: 'draft',
            light_palette: POLITY_THEME.light,
            dark_palette: POLITY_THEME.dark,
            fonts: POLITY_THEME.fonts,
            text_styles: [],
            created_by_id: ctx.ownerID,
            published_at: null,
          };
          if (create) {
            await f.track('appearance_theme', id('theme'));
            await f.track('appearance_theme_revision', id('revision'));
          } else {
            await f.insert('appearance_theme', { id: id('theme'), ...fields });
            await f.insert('appearance_theme_revision', { id: id('revision'), ...revision });
          }
          const themeInput = {
            name: operation === 'updateDraft' ? 'After' : 'Before',
            description: null,
            light_palette: POLITY_THEME.light,
            dark_palette: POLITY_THEME.dark,
            fonts: POLITY_THEME.fonts,
            text_styles: [],
          };
          const args = create
            ? {
                id: id('theme'),
                revision_id: id('revision'),
                slug: fields.slug,
                ...themeInput,
                ...(group ? { group_id: groupID } : {}),
              }
            : operation === 'updateDraft'
              ? {
                  id: id('theme'),
                  theme_id: id('theme'),
                  revision_id: id('revision'),
                  version: 1,
                  ...themeInput,
                }
              : operation === 'publish'
                ? { theme_id: id('theme'), revision_id: id('revision') }
                : { id: id('theme') };
          const request =
            typeof groupID === 'string'
              ? queries.appearanceThemes.groupEditor({ groupId: groupID })
              : queries.appearanceThemes.personalEditor({});
          const predicate = (data: unknown, after: boolean) => {
            const theme = found(data, id('theme'));
            if ((!after && create) || (after && operation === 'delete')) return !theme;
            if (
              !theme ||
              theme.name !== (after && operation === 'updateDraft' ? 'After' : 'Before')
            )
              return false;
            const rev = found(theme.revisions, id('revision'));
            return (
              !!rev &&
              rev.status === (after && operation === 'publish' ? 'published' : 'draft') &&
              theme.current_revision_id ===
                (after && operation === 'publish' ? id('revision') : null)
            );
          };
          return {
            args: args as unknown as ReadonlyJSONValue,
            observe: {
              request,
              before: (data: unknown) => predicate(data, false),
              after: (data: unknown) => predicate(data, actor === 'owner'),
            },
            async verify() {
              if (actor !== 'owner') {
                await f.expect('appearance_theme', id('theme'), create ? null : fields);
                await f.expect(
                  'appearance_theme_revision',
                  id('revision'),
                  create ? null : revision
                );
                return;
              }
              if (operation === 'delete') {
                await f.expect('appearance_theme', id('theme'), null);
                await f.expect('appearance_theme_revision', id('revision'), null);
                return;
              }
              await f.expect('appearance_theme', id('theme'), {
                ...fields,
                name: operation === 'updateDraft' ? 'After' : 'Before',
                current_revision_id: operation === 'publish' ? id('revision') : null,
              });
              const { published_at: _publishedAt, ...revisionFields } = revision;
              void _publishedAt;
              await f.expect('appearance_theme_revision', id('revision'), {
                ...revisionFields,
                status: operation === 'publish' ? 'published' : 'draft',
                ...(operation !== 'publish' ? { published_at: null } : {}),
              });
              if (operation === 'publish')
                assert(
                  (await f.rows('appearance_theme_revision', id('revision')))[0].published_at !=
                    null
                );
            },
            restore: async () => {
              // The current revision FK points back to a child; break only the fixture's link before deleting.
              await ctx.sql`update appearance_theme set current_revision_id = null where id = ${id('theme')}`;
              await f.restore();
            },
            verifyRestored: () => f.verifyRestored(),
          };
        },
      }))
    )
  );
}
