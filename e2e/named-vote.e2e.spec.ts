import { pbkdf2Sync } from 'node:crypto';
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/test';
import { db } from './fixtures/db';
import { removeActorAuthState } from './fixtures/auth';
import { waitForAppReady } from './fixtures/readiness';
import {
  authenticateGovernanceActor,
  governanceActors,
  governanceEntityId,
} from './fixtures/domains/governance';

const VOTING_PIN = '2468';

function votingPasswordHash(pin: string) {
  const salt = Buffer.alloc(16, 11);
  const hash = pbkdf2Sync(pin, salt, 100_000, 32, 'sha256');
  return `${salt.toString('base64')}:${hash.toString('base64')}`;
}

async function castChoice(page: Page, label: string) {
  await page.locator('[data-action-id="agendas.toolbar.ballot.cast"]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button').filter({ hasText: label }).click();
  await dialog.getByRole('button', { name: /Confirm|Bestätigen/i }).click();
  const pinInputs = dialog.locator('input[inputmode="numeric"]');
  await expect(pinInputs).toHaveCount(4);
  const resolvedPinInputs = await pinInputs.all();
  for (const [digit, input] of [...VOTING_PIN].map(
    (digit, index) => [digit, resolvedPinInputs[index]] as const
  )) {
    await input.fill(digit);
  }
}

test('runs a named vote with two actors and closes the persisted result @pr', async ({
  browser,
  e2eRun,
  page,
  seed,
}) => {
  const sql = db();
  const actors = governanceActors(e2eRun);
  const voterB = await authenticateGovernanceActor(browser, actors, 'voter-b');
  const agendaItemId = governanceEntityId(e2eRun, 'named-vote-agenda');
  const voteId = governanceEntityId(e2eRun, 'named-vote');
  const acceptChoiceId = governanceEntityId(e2eRun, 'named-vote-accept');
  const rejectChoiceId = governanceEntityId(e2eRun, 'named-vote-reject');
  const participantId = governanceEntityId(e2eRun, 'named-vote-participant-b');
  const participantRoleId = governanceEntityId(e2eRun, 'named-vote-participant-role-b');
  const passwordId = governanceEntityId(e2eRun, 'named-vote-password-b');

  await sql`
    update public.event set status = 'active', updated_at = now()
    where id = ${seed.eventId}::uuid;
    insert into public.agenda_item (
      id, event_id, creator_id, title, description, type, status,
      order_index, voting_phase, created_at, updated_at
    ) values (
      ${agendaItemId}::uuid, ${seed.eventId}::uuid, ${seed.userId}::uuid,
      ${`${e2eRun.prefix} Named vote`}, 'Two-actor named vote', 'vote',
      'in-progress', 2, 'internal', now(), now()
    );
    insert into public.vote (
      id, agenda_item_id, title, description, status, purpose,
      majority_type, closing_type, ballot_visibility, visibility,
      created_at, updated_at
    ) values (
      ${voteId}::uuid, ${agendaItemId}::uuid, ${`${e2eRun.prefix} Named vote`},
      'Two-actor named vote', 'pending', 'closing', 'relative', 'moderator',
      'named', 'public', now(), now()
    );
    insert into public.vote_choice (id, vote_id, label, semantic_key, order_index, created_at)
    values
      (${acceptChoiceId}::uuid, ${voteId}::uuid, 'Accept', 'accept', 0, now()),
      (${rejectChoiceId}::uuid, ${voteId}::uuid, 'Reject', 'reject', 1, now());
    insert into public.event_participant (
      id, event_id, user_id, group_id, status, visibility, created_at
    ) values (
      ${participantId}::uuid, ${seed.eventId}::uuid, ${voterB.id}::uuid,
      ${seed.groupId}::uuid, 'confirmed', 'public', now()
    );
    insert into public.event_participant_role (
      id, event_participant_id, role_id, assigned_at, assigned_by_id, created_at
    ) values (
      ${participantRoleId}::uuid, ${participantId}::uuid, ${seed.eventRoleId}::uuid,
      now(), ${seed.userId}::uuid, now()
    );
    update public.voting_password
    set password_hash = ${votingPasswordHash(VOTING_PIN)}, updated_at = now()
    where user_id = ${seed.userId}::uuid;
    insert into public.voting_password (
      id, user_id, password_hash, last_verified_at, created_at, updated_at
    ) values (
      ${passwordId}::uuid, ${voterB.id}::uuid, ${votingPasswordHash(VOTING_PIN)},
      now(), now(), now()
    ) on conflict (user_id) do update
    set password_hash = excluded.password_hash, updated_at = now();
  `;

  const voterBContext = await browser.newContext({ storageState: voterB.storageStatePath });
  const voterBPage = await voterBContext.newPage();
  try {
    await page.goto(`/event/${seed.eventId}/agenda/${agendaItemId}`);
    await waitForAppReady(page);
    await page.locator('[data-action-id="agendas.toolbar.vote.start"]').click();
    await expect
      .poll(async () => {
        const rows = await sql`select status from public.vote where id = ${voteId}::uuid`;
        return rows[0]?.status ?? null;
      })
      .toMatch(/^(indicative|indication)$/);

    await castChoice(page, 'Accept');
    await voterBPage.goto(`/event/${seed.eventId}/agenda/${agendaItemId}`);
    await waitForAppReady(voterBPage);
    await castChoice(voterBPage, 'Reject');

    await expect
      .poll(async () => {
        const rows = await sql`
          select count(*)::int as count,
                 count(voter_participation_id)::int as linked
          from public.indicative_choice_decision
          where vote_id = ${voteId}::uuid
        `;
        return rows[0];
      })
      .toMatchObject({ count: 2, linked: 2 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await page.locator('[data-action-id="agendas.toolbar.vote.start-final"]').click();
    await expect
      .poll(async () => {
        const rows = await sql`select status from public.vote where id = ${voteId}::uuid`;
        return rows[0]?.status ?? null;
      })
      .toBe('final');

    await castChoice(page, 'Accept');
    await voterBPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(voterBPage);
    await castChoice(voterBPage, 'Reject');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await page.locator('[data-action-id="agendas.toolbar.vote.close-final"]').click();

    await expect
      .poll(async () => {
        const [voteRows, decisionRows] = await Promise.all([
          sql`select status from public.vote where id = ${voteId}::uuid`,
          sql`
            select count(*)::int as count
            from public.final_choice_decision
            where vote_id = ${voteId}::uuid
          `,
        ]);
        return { status: voteRows[0]?.status, decisions: decisionRows[0]?.count };
      })
      .toEqual({ status: 'closed', decisions: 2 });
  } finally {
    await voterBContext.close();
    await removeActorAuthState(voterB);
  }
});
