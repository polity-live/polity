import { expect, type Page } from '@playwright/test';
import type { CreateFlowPage, CreateFormStyle } from '../fixtures/create-flow-page';
import type { SeedData } from '../fixtures/seed';
import { mediaUrl } from '../fixtures/media-url';

export const layouts = ['one_page', 'carousel'] as const satisfies readonly CreateFormStyle[];
export const visibilityValues = ['public', 'authenticated', 'private'] as const;

function params(values: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export async function gotoGroup(create: CreateFlowPage, layout: CreateFormStyle = 'one_page') {
  await create.goto('/create/group', layout);
}

export async function gotoAmendment(create: CreateFlowPage, layout: CreateFormStyle = 'one_page') {
  await create.goto('/create/amendment', layout);
}

export async function gotoEvent(
  create: CreateFlowPage,
  seed: SeedData,
  layout: CreateFormStyle = 'one_page',
  options: {
    eventType?: string;
    withGroup?: boolean;
    time?: 'empty' | 'valid' | 'invalid';
  } = {}
) {
  const time =
    options.time === 'empty'
      ? {}
      : options.time === 'invalid'
        ? { startDate: '2030-01-15', startTime: '12:00' }
        : {
            startDate: '2030-01-15',
            startTime: '10:00',
            endDate: '2030-01-15',
            endTime: '12:00',
          };

  await create.goto(
    `/create/event${params({
      eventType: options.eventType,
      groupId: options.withGroup ? seed.groupId : undefined,
      ...time,
    })}`,
    layout
  );
}

export async function gotoAgendaItem(
  create: CreateFlowPage,
  seed: SeedData,
  layout: CreateFormStyle = 'one_page',
  type = 'discussion',
  withEvent = true
) {
  await create.goto(
    `/create/agenda-item${params({
      eventId: withEvent ? seed.eventId : undefined,
      type,
    })}`,
    layout
  );
}

export async function gotoTodo(create: CreateFlowPage, layout: CreateFormStyle = 'one_page') {
  await create.goto('/create/todo', layout);
}

export async function gotoStatement(create: CreateFlowPage, layout: CreateFormStyle = 'one_page') {
  await create.goto('/create/statement', layout);
}

export async function gotoPayment(
  create: CreateFlowPage,
  seed: SeedData,
  layout: CreateFormStyle = 'one_page',
  withGroup = true,
  direction?: 'income' | 'expense'
) {
  await create.goto(
    `/create/payment${params({
      groupId: withGroup ? seed.groupId : undefined,
      direction,
    })}`,
    layout
  );
}

export async function gotoElectionCandidate(
  create: CreateFlowPage,
  layout: CreateFormStyle = 'one_page'
) {
  await create.goto('/create/election-candidate', layout);
}

export async function gotoBlogEntry(
  create: CreateFlowPage,
  seed: SeedData,
  layout: CreateFormStyle = 'one_page',
  withGroup = false
) {
  await create.goto(
    `/create/blog-entry${params({ groupId: withGroup ? seed.groupId : undefined })}`,
    layout
  );
}

export async function fillMinimalGroup(create: CreateFlowPage, prefix: string) {
  await create.form.fillText('name', `${prefix} Created Group`);
}

export async function fillMinimalAmendment(create: CreateFlowPage, prefix: string) {
  await create.form.fillText('title', `${prefix} Created Amendment`);
}

export async function fillMinimalEvent(create: CreateFlowPage, prefix: string) {
  await create.form.fillText('title', `${prefix} Created Event`);
}

export async function fillMinimalAgendaItem(create: CreateFlowPage, prefix: string) {
  await create.form.fillText('title', `${prefix} Created Agenda Item`);
}

export async function fillMinimalTodo(create: CreateFlowPage, prefix: string) {
  await create.form.fillText('title', `${prefix} Created Todo`);
}

export async function fillMinimalStatement(create: CreateFlowPage, prefix: string) {
  await create.form.fillText('text', `${prefix} Created statement text`);
}

export async function fillMinimalPayment(create: CreateFlowPage, seed: SeedData, prefix: string) {
  await create.form.fillText('label', `${prefix} Created Payment`);
  await create.form.fillText('amount', '12.50');
  await create.selectTypeahead('entity-user', 'E2E', { entityType: 'user' });
  await expect(create.page.locator('[data-create-field="entity-user"]')).not.toContainText(
    'Required.'
  );
}

export async function fillMinimalElectionCandidate(
  create: CreateFlowPage,
  seed: SeedData,
  prefix: string
) {
  await create.selectTypeahead('election', seed.electionTitle, { entityType: 'election' });
  await create.form.fillText('statement', `${prefix} Candidate statement`);
}

export async function fillMinimalBlogEntry(create: CreateFlowPage, prefix: string) {
  await create.form.fillText('title', `${prefix} Created Blog Entry`);
}

export async function applyOptionalMediaUrl(page: Page, fieldKey: string, prefix: string) {
  const field = page.locator(`[data-create-field="${fieldKey}"]`);
  if (!(await field.count())) return false;

  const input = field
    .locator('input[type="url"], input[placeholder*="http"], input:not([type="hidden"])')
    .first();
  if (!(await input.count())) return false;

  await input.fill(mediaUrl(prefix));
  return true;
}
