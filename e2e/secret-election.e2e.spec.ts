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
  const salt = Buffer.alloc(16, 13);
  const hash = pbkdf2Sync(pin, salt, 100_000, 32, 'sha256');
  return `${salt.toString('base64')}:${hash.toString('base64')}`;
}

async function castCandidate(page: Page, candidateName: string) {
  await page.locator('[data-action-id="agendas.toolbar.ballot.cast"]').click();
  const ballotDialog = page.getByRole('dialog', { name: /Cast Vote|Stimme abgeben/i });
  await ballotDialog.getByRole('button').filter({ hasText: candidateName }).click();
  await ballotDialog.getByRole('button', { name: /Confirm|Bestätigen/i }).click();

  const pinDialog = page.getByRole('dialog', { name: /Confirm with PIN|Mit PIN bestätigen/i });
  const pinInputs = pinDialog.locator('input[inputmode="numeric"]');
  await expect(pinInputs).toHaveCount(4);
  const resolvedPinInputs = await pinInputs.all();
  for (const [digit, input] of [...VOTING_PIN].map(
    (digit, index) => [digit, resolvedPinInputs[index]] as const
  )) {
    await input.fill(digit);
  }
  const submissionOverlay = page.locator('[data-slot="vote-submission-overlay"]');
  await expect(submissionOverlay).toBeVisible();
  const successToast = page
    .getByRole('region', { name: /Notifications/i })
    .getByRole('listitem')
    .filter({ hasText: /Vote cast|Stimme abgegeben/i });
  await expect(successToast).toBeVisible();
  await successToast.getByRole('button', { name: /Close toast|Toast schließen/i }).click();
  await expect(pinDialog).toBeHidden();
}

test('keeps multi-actor election ballots secret through final result close @nightly @critical @acceptance', async ({
  browser,
  e2eRun,
  page,
  seed,
}) => {
  const sql = db();
  const actors = governanceActors(e2eRun);
  const voterB = await authenticateGovernanceActor(browser, actors, 'voter-b');
  const candidateAId = governanceEntityId(e2eRun, 'secret-candidate-a');
  const candidateBId = governanceEntityId(e2eRun, 'secret-candidate-b');
  const participantId = governanceEntityId(e2eRun, 'secret-election-participant-b');
  const participantRoleId = governanceEntityId(e2eRun, 'secret-election-role-b');
  const passwordId = governanceEntityId(e2eRun, 'secret-election-password-b');
  const candidateAName = `${e2eRun.prefix} Fixture User`;
  const candidateBName = 'E2E Test Actor';

  await sql`
    update public.event
    set status = 'active', attendance_mode = 'hybrid', updated_at = now()
    where id = ${seed.eventId}::uuid;
    update public.agenda_item
    set status = 'in-progress', voting_phase = 'internal', activated_at = now(), updated_at = now()
    where id = ${seed.agendaItemId}::uuid;
    update public.election
    set status = 'pending', ballot_visibility = 'secret', updated_at = now()
    where id = ${seed.electionId}::uuid;
    delete from public.election_candidate where election_id = ${seed.electionId}::uuid;
    insert into public.election_candidate (
      id, election_id, user_id, name, description, status, order_index, created_at
    ) values
      (
        ${candidateAId}::uuid, ${seed.electionId}::uuid, ${seed.extraUserId}::uuid,
        ${candidateAName}, ${candidateAName}, 'nominated', 0, now()
      ),
      (
        ${candidateBId}::uuid, ${seed.electionId}::uuid, ${seed.userId}::uuid,
        ${candidateBName}, ${candidateBName}, 'nominated', 1, now()
      );
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
    await page.goto(`/event/${seed.eventId}/agenda/${seed.agendaItemId}`);
    await waitForAppReady(page);
    await page.locator('[data-action-id="agendas.toolbar.vote.start"]').click();
    await expect
      .poll(async () => {
        const rows =
          await sql`select status from public.election where id = ${seed.electionId}::uuid`;
        return rows[0]?.status ?? null;
      })
      .toMatch(/^(indicative|indication)$/);

    await castCandidate(page, candidateAName);
    await voterBPage.goto(`/event/${seed.eventId}/agenda/${seed.agendaItemId}`);
    await waitForAppReady(voterBPage);
    await castCandidate(voterBPage, candidateAName);

    await expect
      .poll(async () => {
        const rows = await sql`
          select count(*)::int as count,
                 count(elector_participation_id)::int as linked
          from public.indicative_candidate_selection
          where election_id = ${seed.electionId}::uuid
        `;
        return rows[0];
      })
      .toMatchObject({ count: 2, linked: 0 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await page.locator('[data-action-id="agendas.toolbar.vote.start-final"]').click();
    await expect
      .poll(async () => {
        const rows =
          await sql`select status from public.election where id = ${seed.electionId}::uuid`;
        return rows[0]?.status ?? null;
      })
      .toBe('final');

    await castCandidate(page, candidateAName);
    await voterBPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(voterBPage);
    await castCandidate(voterBPage, candidateAName);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await page.locator('[data-action-id="agendas.toolbar.vote.close-final"]').click();

    await expect
      .poll(async () => {
        const [electionRows, selectionRows] = await Promise.all([
          sql`select status from public.election where id = ${seed.electionId}::uuid`,
          sql`
            select count(*)::int as count,
                   count(elector_participation_id)::int as linked
            from public.final_candidate_selection
            where election_id = ${seed.electionId}::uuid
          `,
        ]);
        return {
          status: electionRows[0]?.status,
          count: selectionRows[0]?.count,
          linked: selectionRows[0]?.linked,
        };
      })
      .toEqual({ status: 'closed', count: 2, linked: 0 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expect(
      page.locator('[data-election-candidate-row="true"]').filter({ hasText: candidateAName })
    ).toBeVisible();
    await expect(
      page.locator('[data-election-candidate-row="true"]').filter({ hasText: candidateBName })
    ).toBeVisible();
    await expect(page.getByText('2 · 100%')).toBeVisible();
    await expect(page.getByText(voterB.email, { exact: true })).toHaveCount(0);
  } finally {
    await voterBContext.close();
    await removeActorAuthState(voterB);
  }
});
