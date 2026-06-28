import { expect } from '@playwright/test';
import type {
  CreateFlowPage,
  SubmitWaitForSavedAndNavigateOptions,
} from '../fixtures/create-flow-page';
import { db } from '../fixtures/db';
import type { SeedData } from '../fixtures/seed';

export type CreateSmokeKind =
  | 'agendaItem'
  | 'amendment'
  | 'blogEntry'
  | 'electionCandidate'
  | 'event'
  | 'group'
  | 'payment'
  | 'statement'
  | 'todo';

interface SubmitSmokeOptions {
  kind: CreateSmokeKind;
  prefix: string;
  seed?: SeedData;
}

type SmokeExpectation = SubmitWaitForSavedAndNavigateOptions;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uuidPattern() {
  return '[0-9a-f-]+';
}

async function expectPageText(create: CreateFlowPage, text: string) {
  await expect(create.page.getByText(text).first()).toBeVisible({ timeout: 60_000 });
}

async function expectRow(fetchCount: () => Promise<number>) {
  await expect.poll(fetchCount, { timeout: 60_000 }).toBeGreaterThan(0);
}

function requireSeed(kind: CreateSmokeKind, seed: SeedData | undefined): SeedData {
  if (!seed) {
    throw new Error(`Smoke expectation for ${kind} requires seeded prerequisite data.`);
  }
  return seed;
}

function buildSmokeExpectation(
  create: CreateFlowPage,
  { kind, prefix, seed }: SubmitSmokeOptions
): SmokeExpectation {
  const sql = db();

  switch (kind) {
    case 'group': {
      const name = `${prefix} Created Group`;
      return {
        expectedUrl: new RegExp(`/group/${uuidPattern()}/?$`),
        expectTargetVisible: () => expectPageText(create, name),
        verifyCreatedRecord: () =>
          expectRow(async () => {
            const rows = await sql`select id from public."group" where name = ${name} limit 1`;
            return rows.length;
          }),
      };
    }

    case 'event': {
      const title = `${prefix} Created Event`;
      return {
        expectedUrl: new RegExp(`/event/${uuidPattern()}/?$`),
        expectTargetVisible: () => expectPageText(create, title),
        verifyCreatedRecord: () =>
          expectRow(async () => {
            const rows = await sql`select id from public.event where title = ${title} limit 1`;
            return rows.length;
          }),
      };
    }

    case 'amendment': {
      const title = `${prefix} Created Amendment`;
      return {
        expectedUrl: new RegExp(`/amendment/${uuidPattern()}/?$`),
        expectTargetVisible: () => expectPageText(create, title),
        verifyCreatedRecord: () =>
          expectRow(async () => {
            const rows = await sql`select id from public.amendment where title = ${title} limit 1`;
            return rows.length;
          }),
      };
    }

    case 'agendaItem': {
      const seeded = requireSeed(kind, seed);
      const title = `${prefix} Created Agenda Item`;
      return {
        expectedUrl: new RegExp(
          `/event/${escapeRegExp(seeded.eventId)}/agenda/${uuidPattern()}/?$`
        ),
        expectTargetVisible: () => expectPageText(create, title),
        verifyCreatedRecord: () =>
          expectRow(async () => {
            const rows =
              await sql`select id from public.agenda_item where title = ${title} limit 1`;
            return rows.length;
          }),
      };
    }

    case 'todo': {
      const title = `${prefix} Created Todo`;
      return {
        expectedUrl: new RegExp(`/todos/${uuidPattern()}/?$`),
        expectTargetVisible: () => expectPageText(create, title),
        verifyCreatedRecord: () =>
          expectRow(async () => {
            const rows = await sql`select id from public.todo where title = ${title} limit 1`;
            return rows.length;
          }),
      };
    }

    case 'statement': {
      const text = `${prefix} Created statement text`;
      return {
        expectedUrl: new RegExp(`/statement/${uuidPattern()}/?$`),
        expectTargetVisible: () => expectPageText(create, text),
        verifyCreatedRecord: () =>
          expectRow(async () => {
            const rows = await sql`select id from public.statement where text = ${text} limit 1`;
            return rows.length;
          }),
      };
    }

    case 'payment': {
      const seeded = requireSeed(kind, seed);
      const label = `${prefix} Created Payment`;
      return {
        expectedUrl: new RegExp(`/group/${escapeRegExp(seeded.groupId)}/operation/?#payments$`),
        expectTargetVisible: () => expectPageText(create, label),
        verifyCreatedRecord: () =>
          expectRow(async () => {
            const rows = await sql`select id from public.payment where label = ${label} limit 1`;
            return rows.length;
          }),
      };
    }

    case 'electionCandidate': {
      const seeded = requireSeed(kind, seed);
      const statement = `${prefix} Candidate statement`;
      return {
        expectedUrl: new RegExp(
          `/event/${escapeRegExp(seeded.eventId)}/agenda/${escapeRegExp(seeded.agendaItemId)}/?$`
        ),
        expectTargetVisible: () => expectPageText(create, seeded.electionTitle),
        verifyCreatedRecord: () =>
          expectRow(async () => {
            const rows = await sql`
              select id
              from public.election_candidate
              where election_id = ${seeded.electionId}::uuid
                and description = ${statement}
              limit 1
            `;
            return rows.length;
          }),
      };
    }

    case 'blogEntry': {
      const title = `${prefix} Created Blog Entry`;
      return {
        expectedUrl: new RegExp(`/user/${uuidPattern()}/blog/${uuidPattern()}/?$`),
        expectTargetVisible: () => expectPageText(create, title),
        verifyCreatedRecord: () =>
          expectRow(async () => {
            const rows = await sql`select id from public.blog where title = ${title} limit 1`;
            return rows.length;
          }),
      };
    }
  }
}

export async function submitSmokeAndExpectCreated(
  create: CreateFlowPage,
  options: SubmitSmokeOptions
) {
  await create.submitWaitForSavedAndNavigate(buildSmokeExpectation(create, options));
}
