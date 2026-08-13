import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const explicitDatabaseUrl = process.env.SUPABASE_DB_URL;

if (!explicitDatabaseUrl && process.env.CI) {
  throw new Error('SUPABASE_DB_URL is required for database integration tests in CI.');
}

const databaseUrl =
  explicitDatabaseUrl ??
  process.env.SUPABASE_DB_URL_LOCAL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const admin = postgres(databaseUrl, { max: 1 });
const workerA = postgres(databaseUrl, { max: 1 });
const workerB = postgres(databaseUrl, { max: 1 });
const unauthenticatedRole = postgres(databaseUrl, { max: 1 });

const ids = {
  userA: '95000000-0000-4000-8000-000000000001',
  userB: '95000000-0000-4000-8000-000000000002',
  amendment: '95000000-0000-4000-8000-000000000010',
  processRun: '95000000-0000-4000-8000-000000000011',
  branch: '95000000-0000-4000-8000-000000000012',
  changeRequestA: '95000000-0000-4000-8000-000000000013',
  changeRequestB: '95000000-0000-4000-8000-000000000014',
  election: '95000000-0000-4000-8000-000000000020',
  candidate: '95000000-0000-4000-8000-000000000021',
  elector: '95000000-0000-4000-8000-000000000022',
  electionParticipation: '95000000-0000-4000-8000-000000000023',
  candidateSelection: '95000000-0000-4000-8000-000000000024',
  vote: '95000000-0000-4000-8000-000000000030',
  choice: '95000000-0000-4000-8000-000000000031',
  voter: '95000000-0000-4000-8000-000000000032',
  voterParticipation: '95000000-0000-4000-8000-000000000033',
  choiceDecision: '95000000-0000-4000-8000-000000000034',
} as const;

async function cleanupFixtures() {
  await admin`delete from public.final_choice_decision where id = ${ids.choiceDecision}`;
  await admin`delete from public.final_voter_participation where id = ${ids.voterParticipation}`;
  await admin`delete from public.voter where id = ${ids.voter}`;
  await admin`delete from public.vote_choice where id = ${ids.choice}`;
  await admin`delete from public.vote where id = ${ids.vote}`;
  await admin`delete from public.final_candidate_selection where id = ${ids.candidateSelection}`;
  await admin`delete from public.final_elector_participation where id = ${ids.electionParticipation}`;
  await admin`delete from public.elector where id = ${ids.elector}`;
  await admin`delete from public.election_candidate where id = ${ids.candidate}`;
  await admin`delete from public.election where id = ${ids.election}`;
  await admin`
    delete from public.change_request
    where id in (${ids.changeRequestA}, ${ids.changeRequestB})
  `;
  await admin`delete from public.amendment_process_branch where id = ${ids.branch}`;
  await admin`delete from public.amendment_process_run where id = ${ids.processRun}`;
  await admin`delete from public.amendment where id = ${ids.amendment}`;
  await admin`delete from public."user" where id in (${ids.userA}, ${ids.userB})`;
}

async function seedUsersAndAmendment() {
  await admin`
    insert into public."user" (id, handle)
    values (${ids.userA}, 'governance-db-a'), (${ids.userB}, 'governance-db-b')
  `;
  await admin`
    insert into public.amendment (id, title, created_by_id)
    values (${ids.amendment}, 'Governance database integration', ${ids.userA})
  `;
}

describe('governance concurrency database integration', () => {
  beforeAll(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
    await Promise.all(
      [admin, workerA, workerB, unauthenticatedRole].map(connection =>
        connection.end({ timeout: 5 })
      )
    );
  });

  it('allocates parallel change-request branch numbers without duplicates', async () => {
    await seedUsersAndAmendment();
    await admin`
        insert into public.amendment_process_run (id, amendment_id, created_by_id)
        values (${ids.processRun}, ${ids.amendment}, ${ids.userA})
      `;
    await admin`
        insert into public.amendment_process_branch (id, process_run_id, title)
        values (${ids.branch}, ${ids.processRun}, 'Main branch')
      `;

    const allocate = async (connection: postgres.Sql, changeRequestId: string, userId: string) =>
      connection.begin(async transaction => {
        const lockScope = `${ids.amendment}:${ids.branch}`;
        await transaction`select pg_advisory_xact_lock(hashtextextended(${lockScope}, 0))`;
        const rows = await transaction<{ next_number: number }[]>`
            select coalesce(max(branch_sequence_number), 0) + 1 as next_number
            from public.change_request
            where amendment_id = ${ids.amendment}
              and process_branch_id = ${ids.branch}
          `;
        const nextNumber = Number(rows[0]?.next_number);
        await transaction`
            insert into public.change_request (
              id, amendment_id, process_branch_id, user_id, title,
              status, branch_sequence_number
            ) values (
              ${changeRequestId}, ${ids.amendment}, ${ids.branch}, ${userId},
              ${`CR-${nextNumber}`}, 'open', ${nextNumber}
            )
          `;
        return nextNumber;
      });

    const allocated = await Promise.all([
      allocate(workerA, ids.changeRequestA, ids.userA),
      allocate(workerB, ids.changeRequestB, ids.userB),
    ]);
    const rows = await admin<{ branch_sequence_number: number }[]>`
        select branch_sequence_number
        from public.change_request
        where id in (${ids.changeRequestA}, ${ids.changeRequestB})
        order by branch_sequence_number
      `;

    expect([...allocated].sort()).toEqual([1, 2]);
    expect(rows.map(row => row.branch_sequence_number)).toEqual([1, 2]);
  }, 15_000);

  it('exposes secret vote and election selections only through the service role', async () => {
    await cleanupFixtures();
    await seedUsersAndAmendment();
    await admin`
        insert into public.election (id, title, status, ballot_visibility)
        values (${ids.election}, 'Secret board election', 'closed', 'secret')
      `;
    await admin`
        insert into public.election_candidate (id, election_id, user_id, name)
        values (${ids.candidate}, ${ids.election}, ${ids.userB}, 'Candidate B')
      `;
    await admin`
        insert into public.elector (id, election_id, user_id)
        values (${ids.elector}, ${ids.election}, ${ids.userA})
      `;
    await admin`
        insert into public.final_elector_participation (id, election_id, elector_id)
        values (${ids.electionParticipation}, ${ids.election}, ${ids.elector})
      `;
    await admin`
        insert into public.final_candidate_selection (
          id, election_id, candidate_id, elector_participation_id
        ) values (
          ${ids.candidateSelection}, ${ids.election}, ${ids.candidate}, ${ids.electionParticipation}
        )
      `;
    await admin`
        insert into public.vote (
          id, amendment_id, title, status, purpose, ballot_visibility
        ) values (
          ${ids.vote}, ${ids.amendment}, 'Secret amendment vote', 'closed', 'closing', 'secret'
        )
      `;
    await admin`
        insert into public.vote_choice (id, vote_id, label)
        values (${ids.choice}, ${ids.vote}, 'Accept')
      `;
    await admin`
        insert into public.voter (id, vote_id, user_id)
        values (${ids.voter}, ${ids.vote}, ${ids.userA})
      `;
    await admin`
        insert into public.final_voter_participation (id, vote_id, voter_id)
        values (${ids.voterParticipation}, ${ids.vote}, ${ids.voter})
      `;
    await admin`
        insert into public.final_choice_decision (
          id, vote_id, choice_id, voter_participation_id
        ) values (
          ${ids.choiceDecision}, ${ids.vote}, ${ids.choice}, ${ids.voterParticipation}
        )
      `;

    await expect(
      unauthenticatedRole.begin(async transaction => {
        await transaction`set local role authenticated`;
        await transaction`select set_config('request.jwt.claim.sub', ${ids.userB}, true)`;
        return transaction`
            select id from public.final_candidate_selection where id = ${ids.candidateSelection}
          `;
      })
    ).rejects.toThrow(/permission denied|row-level security/i);

    const visible = await admin.begin(async transaction => {
      await transaction`set local role service_role`;
      const electionRows = await transaction`
          select id from public.final_candidate_selection where id = ${ids.candidateSelection}
        `;
      const voteRows = await transaction`
          select id from public.final_choice_decision where id = ${ids.choiceDecision}
        `;
      return { electionCount: electionRows.length, voteCount: voteRows.length };
    });

    expect(visible).toEqual({ electionCount: 1, voteCount: 1 });
  }, 15_000);
});
