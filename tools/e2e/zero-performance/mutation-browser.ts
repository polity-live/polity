import assert from 'node:assert/strict';
import { pbkdf2Sync, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { expect, type Page } from '@playwright/test';
import { db } from '../../../e2e/fixtures/db';
import type { SeedData } from '../../../e2e/fixtures/seed';
import { waitForAppReady } from '../../../e2e/fixtures/readiness';
import { MutationFixtures, mutationFixtureID } from './mutation-fixtures';

export interface MutationBrowserResult {
  action: 'save' | 'send-message' | 'change-membership' | 'vote';
  uiMs: number | null;
  /** Independent committed SQL observation; an upper bound, including SQL polling. */
  serverConfirmedMs: number | null;
  finalVisibleMs: number | null;
  serverOutcome: 'success' | 'server-error' | 'unconfirmed';
  databaseVerified: boolean;
  reloadVerified?: boolean;
  reloadVerificationMs?: number | null;
  failures: string[];
  confirmationSource: 'independent-sql';
  confirmationSemantics: 'committed-state-observation-upper-bound';
  uiEvidence: string;
  rejection?: { action: string; serverOutcome: 'server-error'; databaseUnchanged: boolean };
}

export interface BrowserMutationPhases {
  perform: () => Promise<void>;
  visibleReaction: () => Promise<void>;
  committedState: () => Promise<void>;
  finalVisibleState: () => Promise<void>;
  reloadState?: () => Promise<void>;
}

/** Journeys supplies a browser context without Playwright's baseURL option. */
export function browserMutationRouteURL(path: string, appURL: string | undefined): string {
  assert(appURL, 'Benchmark application URL is required');
  const origin = new URL(appURL);
  assert(['http:', 'https:'].includes(origin.protocol), 'Benchmark application URL must use HTTP');
  return new URL(path, origin).href;
}

export const saveReloadReadinessChecks = [
  ['save reload app-ready', 'data-app-state', 'ready'],
  ['save reload auth-ready', 'data-auth-state', 'authenticated'],
  ['save reload data-hydrated', 'data-data-state', 'hydrated'],
  ['save reload zero-connected', 'data-zero-connection', 'connected'],
] as const;

/** Fixed diagnostics preserve the shared readiness checks and their per-check timeout. */
export async function verifySaveReload(
  checks: {
    navigation: () => Promise<void>;
    readiness: (attribute: string, value: string, timeout: number) => Promise<void>;
    heading: () => Promise<void>;
  },
  setStage: (stage: string) => void
): Promise<void> {
  setStage('save reload navigation');
  await checks.navigation();
  for (const [label, attribute, value] of saveReloadReadinessChecks) {
    setStage(label);
    await checks.readiness(attribute, value, 90_000);
  }
  setStage('save reload renamed-heading');
  await checks.heading();
}
/** UI and committed-state observers are independent; neither duration is an SDK ACK. */
export async function measureBrowserMutationPhases(
  phases: BrowserMutationPhases,
  record: (
    phase: 'uiMs' | 'serverConfirmedMs' | 'finalVisibleMs' | 'reloadVerificationMs',
    elapsed: number
  ) => void,
  now: () => number = () => performance.now()
): Promise<void> {
  const start = now();
  await phases.perform();
  const observations = await Promise.allSettled([
    phases.visibleReaction().then(() => record('uiMs', now() - start)),
    phases.committedState().then(() => record('serverConfirmedMs', now() - start)),
  ]);
  const failed = observations.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  await phases.finalVisibleState();
  record('finalVisibleMs', now() - start);
  if (phases.reloadState) {
    const reloadStart = now();
    await phases.reloadState();
    record('reloadVerificationMs', now() - reloadStart);
  }
}

/** Uses the real owner page supplied by journeys. Every fixture enforces isolated DB aliases. */
export async function measureMutationBrowserActions(
  page: Page,
  seed: SeedData,
  conversation: { conversationId: string },
  onUpdate: (rows: MutationBrowserResult[]) => Promise<void>,
  inspectCurrentQueries: () => Promise<unknown> = async () => undefined
): Promise<MutationBrowserResult[]> {
  const sql = db();
  // Assert isolation before any database write or UI navigation.
  new MutationFixtures(sql);
  const namespace = `browser-mutation:${randomUUID()}`;
  const rows: MutationBrowserResult[] = [];
  let stage = 'fixture preparation';
  const ready = async (path: string) => {
    stage = 'route readiness';
    await page.goto(browserMutationRouteURL(path, process.env.VITE_APP_URL));
    await waitForAppReady(page);
    stage = 'UI preparation';
  };
  const poll = async (predicate: () => Promise<boolean>) => {
    await expect.poll(predicate, { timeout: 30_000, intervals: [25, 50, 100, 200] }).toBe(true);
  };
  async function run(
    action: MutationBrowserResult['action'],
    exercise: (f: MutationFixtures, row: MutationBrowserResult) => Promise<void>
  ) {
    stage = 'fixture preparation';
    const f = new MutationFixtures(sql);
    const row: MutationBrowserResult = {
      action,
      uiMs: null,
      serverConfirmedMs: null,
      finalVisibleMs: null,
      serverOutcome: 'unconfirmed',
      databaseVerified: false,
      confirmationSource: 'independent-sql',
      confirmationSemantics: 'committed-state-observation-upper-bound',
      uiEvidence: '',
      failures: [],
    };
    try {
      await exercise(f, row);
    } catch (error) {
      const name =
        error instanceof Error && /^[A-Za-z]*Error$/.test(error.name) ? error.name : 'Error';
      // Fixed phase labels explain failures without exporting UI text or arguments.
      row.failures.push(`action_failed:${name}:${stage}`);
    } finally {
      try {
        // Preserve real local readings before fixture cleanup or the next
        // document navigation releases this action's subscribed views.
        await inspectCurrentQueries();
      } catch {
        row.failures.push('query_inspection_failed');
      }
      try {
        await f.restore();
        await f.verifyRestored();
      } catch {
        row.failures.push('fixture_restoration_failed');
      }
      rows.push(row);
      await onUpdate([...rows]);
    }
  }
  const phasesFor = (row: MutationBrowserResult, phases: BrowserMutationPhases) => {
    stage = 'write and state observation';
    const reloadState = phases.reloadState;
    return measureBrowserMutationPhases(
      {
        ...phases,
        finalVisibleState: async () => {
          stage = 'current final visible state';
          await phases.finalVisibleState();
        },
        reloadState: reloadState
          ? async () => {
              stage = 'reload durability verification';
              await reloadState();
            }
          : undefined,
      },
      (phase, elapsed) => {
        row[phase] = elapsed;
        if (phase === 'reloadVerificationMs') row.reloadVerified = true;
        if (phase === 'serverConfirmedMs') {
          row.serverOutcome = 'success';
          row.databaseVerified = true;
        }
      }
    );
  };
  await run('save', async (f, row) => {
    const name = `Mutation save ${namespace}`;
    await f.track('group', seed.groupId);
    // The real save handler also renames an existing group conversation and syncs hashtags.
    await f.trackScope('conversation', 'group_id', seed.groupId);
    await f.trackScope('group_hashtag', 'group_id', seed.groupId);
    await f.trackScope('notification', 'related_group_id', seed.groupId);
    await f.trackScope('search_document', 'entity_id', seed.groupId);
    await ready(`/group/${seed.groupId}/settings`);
    await page.locator('#name').fill(name);
    await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
    row.uiEvidence = 'Renamed group heading after the save handler navigates to the group';
    await phasesFor(row, {
      perform: () => page.locator('[data-action-id="groups.edit.submit"]').click(),
      visibleReaction: async () => {
        await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
      },
      committedState: () =>
        poll(
          async () =>
            (await sql`select name from public.group where id=${seed.groupId}`)[0]?.name === name
        ),
      finalVisibleState: async () => {
        await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
      },
      reloadState: async () => {
        await verifySaveReload(
          {
            navigation: async () => {
              await page.reload();
            },
            readiness: async (attribute, value, timeout) => {
              await expect(page.getByTestId('app-readiness')).toHaveAttribute(attribute, value, {
                timeout,
              });
            },
            heading: async () => {
              await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
            },
          },
          nextStage => {
            stage = nextStage;
          }
        );
      },
    });
  });
  await run('send-message', async (f, row) => {
    const content = `Mutation message ${namespace}`;
    const conversationName = `Mutation conversation ${namespace}`;
    await f.track('conversation', conversation.conversationId);
    await f.trackScope('message', 'conversation_id', conversation.conversationId);
    await f.trackScope('conversation_participant', 'conversation_id', conversation.conversationId);
    await f.trackScope('notification', 'sender_id', seed.userId);
    // Public conversationPage searches persisted names; seeded message copy need not be unique.
    await f.update('conversation', { id: conversation.conversationId, name: conversationName });
    await ready('/messages');
    await page
      .locator('[data-action-id="messages.conversation.search.change"]')
      .fill(conversationName);
    stage = 'conversation search result';
    await expect(page.locator('[data-action-id="messages.conversation.select"]')).toHaveCount(1);
    await page.locator('[data-action-id="messages.conversation.select"]').click();
    stage = 'conversation composer preparation';
    await page.locator('[data-action-id="messages.composer.text.change"]').fill(content);
    const renderedMessage = page.locator('[id^="message-"]').getByText(content, { exact: true });
    await expect(renderedMessage).toHaveCount(0);
    row.uiEvidence = 'Exact new message content visible in the conversation';
    await phasesFor(row, {
      perform: () => page.locator('[data-action-id="messages.composer.send"]').click(),
      visibleReaction: async () => {
        await expect(renderedMessage.first()).toBeVisible();
      },
      committedState: () =>
        poll(async () => {
          const result =
            await sql`select id from public.message where conversation_id=${conversation.conversationId} and sender_id=${seed.userId} and content=${content}`;
          return result.length === 1;
        }),
      finalVisibleState: async () => {
        await expect(renderedMessage.first()).toBeVisible();
      },
      reloadState: async () => {
        await page.reload();
        await waitForAppReady(page);
        await page
          .locator('[data-action-id="messages.conversation.search.change"]')
          .fill(conversationName);
        await expect(page.locator('[data-action-id="messages.conversation.select"]')).toHaveCount(
          1
        );
        await page.locator('[data-action-id="messages.conversation.select"]').click();
        await expect(renderedMessage.first()).toBeVisible();
      },
    });
  });
  await run('change-membership', async (f, row) => {
    const [user] =
      await sql`select handle,first_name,last_name from public.user where id=${seed.extraUserId}`;
    assert(user?.handle, 'Seeded applicant identity exists');
    const [existing] =
      await sql`select id from public.group_membership where group_id=${seed.groupId} and user_id=${seed.extraUserId}`;
    const id = existing ? String(existing.id) : mutationFixtureID(namespace, 'membership');
    await f.track('group_membership', id);
    await f.trackScope('group_membership_role', 'group_membership_id', id);
    await f.trackScope('notification', 'related_group_id', seed.groupId);
    if (existing) await f.update('group_membership', { id, status: 'requested' });
    else
      await f.insert('group_membership', {
        id,
        group_id: seed.groupId,
        user_id: seed.extraUserId,
        status: 'requested',
        visibility: 'public',
        source: 'direct',
        origin_kind: 'direct',
        is_auto_managed: false,
      });
    await ready(`/group/${seed.groupId}/memberships`);
    const applicant = page.locator('tr').filter({ hasText: String(user.handle) });
    await expect(applicant).toHaveCount(1);
    const approval = applicant.locator('[data-action-id="groups.requests.approve.membership"]');
    await expect(approval).toBeVisible();
    // The row's conflict preflight disables approval during route preparation.
    // Measure the real approval click once that required check has completed.
    await expect(approval).toBeEnabled();
    row.uiEvidence = 'Applicant pending approval control disappears after membership activation';
    await phasesFor(row, {
      perform: () => approval.click(),
      visibleReaction: async () => {
        await expect(approval).toHaveCount(0);
      },
      committedState: () =>
        poll(
          async () =>
            (await sql`select status from public.group_membership where id=${id}`)[0]?.status ===
            'active'
        ),
      finalVisibleState: async () => {
        await expect(approval).toHaveCount(0);
        await expect(
          page
            .locator('tr')
            .filter({ hasText: String(user.handle) })
            .first()
        ).toBeVisible();
      },
      reloadState: async () => {
        await page.reload();
        await waitForAppReady(page);
        await expect(
          page
            .locator('tr')
            .filter({ hasText: String(user.handle) })
            .first()
        ).toBeVisible();
        await expect(approval).toHaveCount(0);
      },
    });
  });
  await run('vote', async (f, row) => {
    const agenda = mutationFixtureID(namespace, 'agenda');
    const vote = mutationFixtureID(namespace, 'vote');
    const choice = mutationFixtureID(namespace, 'accept');
    const title = `Mutation vote ${namespace}`;
    const salt = Buffer.alloc(16, 11);
    const password = `${salt.toString('base64')}:${pbkdf2Sync('2468', salt, 100_000, 32, 'sha256').toString('base64')}`;
    await f.track('event', seed.eventId);
    await f.update('event', { id: seed.eventId, status: 'active', attendance_mode: 'online' });
    await f.trackScope('voting_password', 'user_id', seed.userId);
    const [stored] = await sql`select id from public.voting_password where user_id=${seed.userId}`;
    if (stored)
      await f.update('voting_password', { id: String(stored.id), password_hash: password });
    else
      await f.insert('voting_password', {
        id: mutationFixtureID(namespace, 'password'),
        user_id: seed.userId,
        password_hash: password,
      });
    await f.insert('agenda_item', {
      id: agenda,
      event_id: seed.eventId,
      creator_id: seed.userId,
      title,
      description: 'Isolated browser vote',
      type: 'vote',
      status: 'in-progress',
      order_index: 99,
      voting_phase: 'indicative',
    });
    await f.insert('vote', {
      id: vote,
      agenda_item_id: agenda,
      title,
      status: 'indicative',
      purpose: 'closing',
      majority_type: 'relative',
      closing_type: 'moderator',
      ballot_visibility: 'named',
      visibility: 'public',
    });
    await f.insert('vote_choice', {
      id: choice,
      vote_id: vote,
      label: 'Accept',
      semantic_key: 'accept',
      order_index: 0,
    });
    for (const table of ['voter', 'indicative_voter_participation', 'indicative_choice_decision'])
      await f.trackScope(table, 'vote_id', vote);
    await f.trackScope('notification', 'related_event_id', seed.eventId);
    await ready(`/event/${seed.eventId}/agenda/${agenda}`);
    await page.locator('[data-action-id="agendas.toolbar.ballot.cast"]').click();
    let dialog = page.getByRole('dialog').first();
    await dialog.getByRole('button').filter({ hasText: 'Accept' }).click();
    await dialog.getByRole('button', { name: /Confirm|Bestätigen/i }).click();
    dialog = page.getByRole('dialog').first();
    const inputs = dialog.locator('input[inputmode="numeric"]');
    await expect(inputs).toHaveCount(4);
    // The real server-only verifier rejects the wrong PIN before any ballot can be cast.
    for (let i = 0; i < 4; i++) await inputs.nth(i).fill('0');
    await expect(
      dialog
        .getByText(/PIN not confirmed|PIN nicht bestätigt|incorrect|invalid|wrong|falsch|ungültig/i)
        .first()
    ).toBeVisible();
    const denied =
      await sql`select id from public.indicative_choice_decision where vote_id=${vote}`;
    assert.equal(denied.length, 0);
    row.rejection = {
      action: 'votingPassword.verifyVotingPassword',
      serverOutcome: 'server-error',
      databaseUnchanged: true,
    };
    await dialog
      .getByRole('button', { name: /enter pin again|try again|retry|back|zurück|erneut/i })
      .first()
      .click();
    for (let i = 0; i < 4; i++) await inputs.nth(i).fill('');
    for (let i = 0; i < 3; i++) await inputs.nth(i).fill('2468'[i]);
    row.uiEvidence = 'Vote submitted success overlay after PIN confirmation and ballot submission';
    await phasesFor(row, {
      perform: () => inputs.nth(3).fill('8'),
      visibleReaction: async () => {
        await expect(page.getByText('Vote submitted', { exact: true }).first()).toBeVisible();
      },
      committedState: () =>
        poll(async () => {
          const result =
            await sql`select d.id from public.indicative_choice_decision d join public.indicative_voter_participation p on p.id=d.voter_participation_id where d.vote_id=${vote} and d.choice_id=${choice} and p.user_id=${seed.userId}`;
          return result.length === 1;
        }),
      finalVisibleState: async () => {
        stage = 'vote success overlay closure';
        // Selector waits also use retry backoff. Poll the actual DOM each frame
        // so a completed exit animation cannot add another retry interval.
        await page.waitForFunction(
          () => !document.querySelector('[data-slot="vote-submission-overlay"]'),
          undefined,
          { polling: 'raf', timeout: 30_000 }
        );
        stage = 'vote current indication proof';
        await page.getByText('Your indication', { exact: true }).first().waitFor({
          state: 'visible',
          timeout: 30_000,
        });
      },
      reloadState: async () => {
        await page.reload();
        await waitForAppReady(page);
        await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();
        await expect(page.getByText('Your indication', { exact: true }).first()).toBeVisible();
      },
    });
  });
  return rows;
}
