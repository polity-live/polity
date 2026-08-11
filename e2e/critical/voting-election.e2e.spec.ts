import { pbkdf2Sync } from 'node:crypto';

import { expect, test } from '../fixtures/test';
import { db } from '../fixtures/db';
import { waitForAppReady } from '../fixtures/readiness';
import { deterministicE2EUuid } from '../fixtures/run';

const VOTING_PIN = '2468';

function votingPasswordHash(pin: string) {
  const salt = Buffer.alloc(16, 7);
  const hash = pbkdf2Sync(pin, salt, 100_000, 32, 'sha256');
  return `${salt.toString('base64')}:${hash.toString('base64')}`;
}

test('starts and casts a secret indicative election ballot @pr @critical', async ({
  e2eRun,
  page,
  seed,
}) => {
  const sql = db();
  const candidateId = deterministicE2EUuid(`${e2eRun.prefix}:election-candidate`);
  const candidateName = `${e2eRun.prefix} Fixture User`;

  await sql`
    update public.event
    set status = 'active', attendance_mode = 'hybrid', updated_at = now()
    where id = ${seed.eventId}::uuid;

    update public.agenda_item
    set status = 'in-progress', voting_phase = 'internal', activated_at = now(), updated_at = now()
    where id = ${seed.agendaItemId}::uuid;

    update public.election
    set status = 'pending', updated_at = now()
    where id = ${seed.electionId}::uuid;

    update public.voting_password
    set password_hash = ${votingPasswordHash(VOTING_PIN)}, updated_at = now()
    where user_id = ${seed.userId}::uuid;

    insert into public.election_candidate (
      id, election_id, user_id, name, description, status, order_index, created_at
    ) values (
      ${candidateId}::uuid, ${seed.electionId}::uuid, ${seed.extraUserId}::uuid,
      ${candidateName}, ${candidateName}, 'nominated', 1, now()
    );
  `;

  await page.goto(`/event/${seed.eventId}/agenda/${seed.agendaItemId}`);
  await waitForAppReady(page);
  const startVote = page.locator('[data-action-id="agendas.toolbar.vote.start"]');
  await expect(startVote).toBeEnabled({ timeout: 30_000 });
  await startVote.click();

  await expect
    .poll(async () => {
      const rows = await sql`
        select status from public.election where id = ${seed.electionId}::uuid
      `;
      return rows[0]?.status ?? null;
    })
    .toMatch(/^(indicative|indication)$/);

  const castBallot = page.locator('[data-action-id="agendas.toolbar.ballot.cast"]');
  await expect(castBallot).toBeEnabled({ timeout: 30_000 });
  await castBallot.click();

  const dialog = page.getByRole('dialog');
  const candidate = dialog.getByRole('button').filter({ hasText: candidateName });
  await expect(candidate).toHaveCount(1, { timeout: 30_000 });
  await candidate.click();
  await dialog.getByRole('button', { name: /Confirm|Bestätigen/i }).click();

  const pinInputs = await dialog.locator('input[inputmode="numeric"]').all();
  expect(pinInputs).toHaveLength(4);
  for (const [digit, input] of [...VOTING_PIN].map(
    (digit, index) => [digit, pinInputs[index]] as const
  )) {
    await input.fill(digit);
  }

  await expect
    .poll(
      async () => {
        const [participations, selections] = await Promise.all([
          sql`
          select id
          from public.indicative_elector_participation
          where election_id = ${seed.electionId}::uuid
            and user_id = ${seed.userId}::uuid
        `,
          sql`
          select candidate_id, elector_participation_id
          from public.indicative_candidate_selection
          where election_id = ${seed.electionId}::uuid
            and candidate_id = ${candidateId}::uuid
        `,
        ]);
        return {
          participationCount: participations.length,
          selectedCandidateId: selections[0]?.candidate_id ?? null,
          secretSelectionIsUnlinked: selections[0]?.elector_participation_id == null,
        };
      },
      { timeout: 30_000 }
    )
    .toEqual({
      participationCount: 1,
      selectedCandidateId: candidateId,
      secretSelectionIsUnlinked: true,
    });

  await expect(page.getByText(/1 indication votes|1 Indikationsstimme/i)).toBeVisible();
});
