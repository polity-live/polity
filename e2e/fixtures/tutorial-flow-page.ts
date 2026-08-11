import { expect, type Locator, type Page, type Request } from '@playwright/test';
import { fromCrossJSON, toCrossJSONAsync } from 'seroval';

import {
  APP_TUTORIAL_CHECKPOINTS,
  getAppTutorialExpectedInputs,
  type AppTutorialLanguage,
  type AppTutorialCheckpoint,
  type AppTutorialCheckpointId,
} from '../../src/features/app-tutorial/catalog';
import { tutorialRouteMatches } from '../../src/features/app-tutorial/logic/tutorialRoute';
import { db } from './db';

const CHECKPOINT_TIMEOUT_MS = 120_000;
const GEOAPIFY_SERVER_FN_PATTERN = '**/_serverFn/**';
const TUTORIAL_ADDRESS = {
  place_id: 'e2e-euckenstrasse-38',
  country: 'Deutschland',
  country_code: 'de',
  state: 'Bayern',
  postcode: '81369',
  city: 'München',
  street: 'Euckenstraße',
  housenumber: '38',
  lat: 48.13956,
  lon: 11.51946,
  formatted: 'Euckenstraße 38, 81369 München, Deutschland',
  result_type: 'building',
};

interface BrowserError {
  checkpointId: string;
  message: string;
}

function cssAttribute(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function visible(locator: Locator) {
  try {
    await locator.waitFor({ state: 'visible', timeout: 500 });
    return true;
  } catch {
    return false;
  }
}

export async function cleanupTutorialRuns(userId: string) {
  const sql = db();
  const runs = await sql<{ id: string }[]>`
    select id
    from public.app_tutorial_run
    where user_id = ${userId}
  `;

  for (const run of runs) {
    await sql`
      delete from public.amendment_process_run
      where amendment_id in (
        select id
        from public.amendment
        where tutorial_run_id = ${run.id}
      )
    `;
    await sql`delete from public.search_document where tutorial_run_id = ${run.id}`;
    await sql`delete from public.app_tutorial_run where id = ${run.id}`;
  }

  return runs.map(run => run.id);
}

export async function tutorialRunIdFor(userId: string) {
  const rows = await db()<{ id: string }[]>`
    select id
    from public.app_tutorial_run
    where user_id = ${userId}
    order by started_at desc
    limit 1
  `;
  return rows[0]?.id ?? null;
}

export async function tutorialCompletionFor(userId: string) {
  const rows = await db()<{ app_tutorial_completed_at: Date | string | null }[]>`
    select app_tutorial_completed_at
    from public.user_preference
    where user_id = ${userId}
  `;
  return rows[0]?.app_tutorial_completed_at ?? null;
}

export async function restoreTutorialCompletion(userId: string, value: Date | string | null) {
  await db()`
    update public.user_preference
    set app_tutorial_completed_at = ${value}
    where user_id = ${userId}
  `;
}

export async function tutorialSandboxRowCount(runId: string) {
  const rows = await db()<{ row_count: number }[]>`
    select (
      (select count(*) from public.app_tutorial_run where id = ${runId}) +
      (select count(*) from public."user" where tutorial_run_id = ${runId}) +
      (select count(*) from public."group" where tutorial_run_id = ${runId}) +
      (select count(*) from public.event where tutorial_run_id = ${runId}) +
      (select count(*) from public.amendment where tutorial_run_id = ${runId}) +
      (select count(*) from public.blog where tutorial_run_id = ${runId}) +
      (select count(*) from public.statement where tutorial_run_id = ${runId}) +
      (select count(*) from public.todo where tutorial_run_id = ${runId}) +
      (select count(*) from public.notification where tutorial_run_id = ${runId}) +
      (select count(*) from public.conversation where tutorial_run_id = ${runId}) +
      (select count(*) from public.payment where tutorial_run_id = ${runId}) +
      (select count(*) from public.search_document where tutorial_run_id = ${runId})
    )::integer as row_count
  `;
  return rows[0]?.row_count ?? -1;
}

export class TutorialFlowPage {
  private activeCheckpointId: AppTutorialCheckpointId = APP_TUTORIAL_CHECKPOINTS[0].id;
  private activeLanguage: AppTutorialLanguage = 'en';
  private readonly browserErrors: BrowserError[] = [];
  private readonly pendingRestartRequests = new Set<Request>();
  private sawRestartRequest = false;
  private restartRequestCount = 0;

  constructor(readonly page: Page) {
    page.on('request', request => {
      if (!this.isTutorialRestartRequest(request)) return;
      this.sawRestartRequest = true;
      this.restartRequestCount += 1;
      this.pendingRestartRequests.add(request);
    });
    const finishRestartRequest = (request: Request) => {
      this.pendingRestartRequests.delete(request);
    };
    page.on('requestfinished', finishRestartRequest);
    page.on('requestfailed', finishRestartRequest);
    page.on('pageerror', error => {
      this.browserErrors.push({
        checkpointId: this.activeCheckpointId,
        message: `pageerror: ${error.message}`,
      });
    });
    page.on('console', message => {
      if (message.type() !== 'error') return;
      if (message.text().startsWith('Failed to load resource:')) return;
      if (
        message.text().includes("Cannot read properties of undefined (reading '_nonReactive')") &&
        message.text().includes('preloadRoute')
      ) {
        return;
      }
      this.browserErrors.push({
        checkpointId: this.activeCheckpointId,
        message: `console.error: ${message.text()}`,
      });
    });
  }

  private isTutorialRestartRequest(request: Request) {
    if (new URL(request.url()).pathname !== '/api/tutorial' || request.method() !== 'POST') {
      return false;
    }
    try {
      return (request.postDataJSON() as { action?: string }).action === 'restart';
    } catch {
      return false;
    }
  }

  async installExternalServiceStubs() {
    await this.page.route('**/api/ai/chat', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: `${JSON.stringify({ type: 'text-delta', text: 'Tutorial response' })}\n`,
      });
    });
  }

  async waitForTutorialRestartRequests() {
    await expect
      .poll(
        () =>
          this.sawRestartRequest && this.pendingRestartRequests.size === 0 ? 'settled' : 'waiting',
        { timeout: CHECKPOINT_TIMEOUT_MS }
      )
      .toBe('settled');
  }

  resetBrowserErrors() {
    this.browserErrors.length = 0;
  }

  tutorialRestartRequestCount() {
    return this.restartRequestCount;
  }

  async useLanguage(userId: string, language: AppTutorialLanguage) {
    this.activeLanguage = language;
    const rows = await db()<{ language: string }[]>`
      update public.user_preference
      set language = ${language},
          updated_at = clock_timestamp()
      where user_id = ${userId}
      returning language
    `;
    expect(rows).toEqual([{ language }]);
    const walRows = await db()<{ lsn: string }[]>`
      select pg_current_wal_lsn()::text as lsn
    `;
    const targetLsn = walRows[0]?.lsn;
    if (!targetLsn) throw new Error('Could not read the language update WAL position.');

    await expect
      .poll(
        async () => {
          const replicationRows = await db()<{ caught_up: boolean }[]>`
            select coalesce(
              bool_or(confirmed_flush_lsn >= ${targetLsn}::pg_lsn),
              false
            ) as caught_up
            from pg_replication_slots
            where slot_name like 'zero_%'
              and active
          `;
          return replicationRows[0]?.caught_up ?? false;
        },
        { timeout: CHECKPOINT_TIMEOUT_MS }
      )
      .toBe(true);

    await this.page.addInitScript(selectedLanguage => {
      window.localStorage.setItem(
        'language-storage',
        JSON.stringify({
          state: { language: selectedLanguage },
          version: 1,
        })
      );
    }, language);
  }

  private expectedInputs() {
    return getAppTutorialExpectedInputs(this.activeLanguage);
  }

  async completeAllCheckpoints() {
    for (let index = 0; index < APP_TUTORIAL_CHECKPOINTS.length; index += 1) {
      const checkpoint = APP_TUTORIAL_CHECKPOINTS[index];
      const nextCheckpoint = APP_TUTORIAL_CHECKPOINTS[index + 1] ?? null;
      this.activeCheckpointId = checkpoint.id;
      console.log(`[tutorial] ${index + 1}/${APP_TUTORIAL_CHECKPOINTS.length} ${checkpoint.id}`);

      await this.expectCheckpoint(checkpoint);
      await this.performCheckpoint(checkpoint);
      await this.waitForNextCheckpoint(nextCheckpoint);
      await this.expectNoBrowserErrors(checkpoint.id);
      console.log(`[tutorial] completed ${checkpoint.id}`);
    }
  }

  private overlay(id: AppTutorialCheckpointId) {
    return this.page.locator(`[data-tutorial-checkpoint="${cssAttribute(id)}"]`);
  }

  private target(checkpoint: AppTutorialCheckpoint) {
    return this.page.locator(`[data-tutorial-current-target="${checkpoint.id}"]:visible`);
  }

  private async unique(locator: Locator) {
    await expect(locator).toHaveCount(1, { timeout: CHECKPOINT_TIMEOUT_MS });
    return locator;
  }

  private async expectCheckpoint(checkpoint: AppTutorialCheckpoint) {
    const overlay = this.overlay(checkpoint.id);
    await expect
      .poll(
        async () => {
          if ((await overlay.count()) !== 1) return `overlay missing at ${this.page.url()}`;

          const alerts = overlay.locator('[role="alert"]:visible');
          if (await alerts.count()) {
            return `tutorial error: ${(await alerts.allTextContents()).join(' | ')}`;
          }

          const expectedRoute = await overlay.getAttribute('data-tutorial-route');
          const url = new URL(this.page.url());
          const currentRoute = `${url.pathname}${url.search}`;
          if (expectedRoute && !tutorialRouteMatches(currentRoute, expectedRoute)) {
            return `route ${currentRoute}; expected ${expectedRoute}`;
          }

          if (!(await overlay.locator('[role="dialog"]:visible').count())) {
            return `coach dialog missing at ${currentRoute}`;
          }
          if (!(await this.target(checkpoint).count())) {
            return `target ${checkpoint.anchor} missing at ${currentRoute}`;
          }
          return 'ready';
        },
        { timeout: CHECKPOINT_TIMEOUT_MS }
      )
      .toBe('ready');
    await this.page.evaluate(
      () =>
        new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        })
    );
  }

  private async waitForNextCheckpoint(checkpoint: AppTutorialCheckpoint | null) {
    const expectedState = checkpoint ? 'next' : 'complete';
    await expect
      .poll(
        async () => {
          const currentOverlay = this.overlay(this.activeCheckpointId);
          const errors = currentOverlay.locator(
            '[role="alert"]:visible, p.text-destructive:visible'
          );
          if (await errors.count()) {
            throw new Error(
              `Tutorial error at checkpoint ${this.activeCheckpointId} after ${
                this.restartRequestCount
              } restart request(s): ${(await errors.allTextContents()).join(' | ')}`
            );
          }
          if (checkpoint && (await this.overlay(checkpoint.id).count()) === 1) {
            return 'next';
          }
          if (
            !checkpoint &&
            (await this.page.locator('[data-tutorial-checkpoint]').count()) === 0
          ) {
            return 'complete';
          }
          return 'waiting';
        },
        { timeout: CHECKPOINT_TIMEOUT_MS }
      )
      .toBe(expectedState);
  }

  private async expectNoBrowserErrors(checkpointId: string) {
    const errors = this.browserErrors.filter(error => error.checkpointId === checkpointId);
    expect(errors, `Browser errors at tutorial checkpoint ${checkpointId}`).toEqual([]);
  }

  private async clickContinue(checkpoint: AppTutorialCheckpoint) {
    const button = this.overlay(checkpoint.id).getByTestId('app-tutorial-continue');
    await expect(button).toBeVisible({ timeout: CHECKPOINT_TIMEOUT_MS });
    await button.click();
  }

  private async completeHorizontalScroll(checkpoint: AppTutorialCheckpoint) {
    if (checkpoint.completion.type !== 'horizontal-scroll') {
      throw new Error(`Checkpoint ${checkpoint.id} does not require horizontal scrolling.`);
    }

    const isDesktop = await this.page.evaluate(
      () => window.matchMedia('(min-width: 768px)').matches
    );
    if (isDesktop) {
      await this.clickContinue(checkpoint);
      return;
    }

    const scroller = await this.unique(
      this.page.locator('[data-tutorial-horizontal-scroller="primary-navigation"]:visible')
    );
    await expect(scroller).toBeVisible({ timeout: CHECKPOINT_TIMEOUT_MS });

    const movement = await scroller.evaluate(element => {
      const range = Math.max(0, element.scrollWidth - element.clientWidth);
      const initialScrollLeft = element.scrollLeft;
      element.scrollLeft = range;
      element.dispatchEvent(new Event('scroll'));

      return {
        range,
        finalScrollLeft: element.scrollLeft,
        actualPixels: Math.abs(element.scrollLeft - initialScrollLeft),
      };
    });

    expect(movement.range).toBeGreaterThan(0);
    expect(movement.finalScrollLeft).toBe(movement.range);
    expect(movement.actualPixels).toBeGreaterThanOrEqual(checkpoint.completion.minimumPixels);
  }

  private async expectMobilePrimarySearchReachable(checkpoint: AppTutorialCheckpoint) {
    const isMobile = await this.page.evaluate(
      () => !window.matchMedia('(min-width: 768px)').matches
    );
    if (!isMobile) return;

    const search = this.target(checkpoint);
    await expect(search).toBeInViewport();
    expect(
      await search.evaluate(element => {
        const scroller = element.closest<HTMLElement>(
          '[data-tutorial-horizontal-scroller="primary-navigation"]'
        );
        if (!scroller) return false;
        const targetRect = element.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        return (
          targetRect.left >= scrollerRect.left &&
          targetRect.right <= scrollerRect.right &&
          targetRect.left >= 0 &&
          targetRect.right <= window.innerWidth
        );
      })
    ).toBe(true);
    await search.click({ trial: true, timeout: CHECKPOINT_TIMEOUT_MS });
  }

  private async clickTarget(checkpoint: AppTutorialCheckpoint) {
    const target = this.target(checkpoint);
    const targetTag = await target.evaluate(element => element.tagName);
    if (checkpoint.anchor === 'tutorial-search-result' || targetTag === 'A') {
      await target.evaluate(element => {
        const preventNavigation = (event: Event) => event.preventDefault();
        element.addEventListener('click', preventNavigation, { once: true });
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      return;
    }
    await target.click({ timeout: CHECKPOINT_TIMEOUT_MS });
  }

  private async selectTypeahead(anchor: string, label: string) {
    const container = await this.unique(
      this.page.locator(`[data-tutorial-anchor="${cssAttribute(anchor)}"]:visible`)
    );
    const initialInputs = container.locator('input:not([type="hidden"]):visible');

    if (!(await initialInputs.count())) {
      const containerIsButton =
        (await container.evaluate(element => element.tagName).catch(() => '')) === 'BUTTON';
      const initialButton = containerIsButton
        ? container
        : container.getByRole('button').filter({ visible: true });
      if (await initialButton.count()) {
        await expect(initialButton).toHaveCount(1);
        await initialButton.click();
      }
    } else {
      await expect(initialInputs).toHaveCount(1);
    }

    const currentContainer = await this.unique(
      this.page.locator(`[data-tutorial-anchor="${cssAttribute(anchor)}"]:visible`)
    );
    const input = currentContainer.locator('input:not([type="hidden"]):visible');
    await expect(input).toHaveCount(1, { timeout: CHECKPOINT_TIMEOUT_MS });
    await expect(input).toBeVisible({ timeout: CHECKPOINT_TIMEOUT_MS });
    await input.fill(label);

    const result = this.page.locator(`[data-typeahead-result="${cssAttribute(label)}"]:visible`);
    await expect(result).toHaveCount(1, { timeout: CHECKPOINT_TIMEOUT_MS });
    await expect(result).toBeVisible({ timeout: CHECKPOINT_TIMEOUT_MS });
    await input.press('Enter');
  }

  private async appendEditorText(text: string, paste = false) {
    const checkpoint = APP_TUTORIAL_CHECKPOINTS.find(item => item.id === this.activeCheckpointId);
    if (!checkpoint) throw new Error('Missing active tutorial checkpoint.');

    let textToInsert = text;
    if (paste) {
      await this.page.evaluate(() => {
        window.__e2eClipboardText = '';
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            readText: async () => window.__e2eClipboardText ?? '',
            writeText: async (value: string) => {
              window.__e2eClipboardText = value;
            },
          },
        });
      });
      const copyButton = this.page
        .getByTestId('app-tutorial-coach-card')
        .getByRole('button', { name: /^Copy:/ });
      await expect(copyButton).toBeVisible({ timeout: CHECKPOINT_TIMEOUT_MS });
      await copyButton.click();
      await expect
        .poll(() => this.page.evaluate(() => window.__e2eClipboardText), {
          timeout: CHECKPOINT_TIMEOUT_MS,
        })
        .toBe(text);
      await expect(copyButton).toContainText(/Copied/);
      textToInsert = await this.page.evaluate(() => window.__e2eClipboardText ?? '');
    }

    const editor = this.target(checkpoint).locator('[contenteditable="true"]:visible');
    await expect(editor).toHaveCount(1, { timeout: CHECKPOINT_TIMEOUT_MS });
    await expect(editor).toBeVisible({ timeout: CHECKPOINT_TIMEOUT_MS });
    await editor.click();
    await this.page.keyboard.press('Control+End');
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.insertText(textToInsert);
    await expect(editor).toContainText(textToInsert, { timeout: CHECKPOINT_TIMEOUT_MS });
    await this.page.keyboard.press('Tab');
  }

  private async switchEditorMode(label: RegExp) {
    const checkpoint = APP_TUTORIAL_CHECKPOINTS.find(item => item.id === this.activeCheckpointId);
    if (!checkpoint) throw new Error('Missing active tutorial checkpoint.');

    await this.clickTarget(checkpoint);
    const option = this.page.getByRole('menuitemradio').filter({ hasText: label });
    await expect(option).toBeVisible({ timeout: CHECKPOINT_TIMEOUT_MS });
    await option.click();
  }

  private async selectNetworkRights() {
    const rights = await this.unique(
      this.page.locator('[data-tutorial-anchor="network-rights-selector"]:visible')
    );
    const rightLabels =
      this.activeLanguage === 'de'
        ? [/^Informationsrecht/i, /^Antragsrecht/i]
        : [/^Information Right/i, /^Amendment Right/i];

    for (const label of rightLabels) {
      const toggle = rights.getByRole('button', { name: label });
      await expect(toggle).toHaveCount(1);
      await toggle.click();
    }
  }

  private async requestNetworkRights() {
    const rights = await this.unique(
      this.page.locator('[data-tutorial-anchor="network-rights-selector"]:visible')
    );
    const rightLabels =
      this.activeLanguage === 'de'
        ? ['Informationsrecht', 'Antragsrecht']
        : ['Information Right', 'Amendment Right'];
    const incomingPrefix = this.activeLanguage === 'de' ? 'Diese Gruppe.*hat' : 'This group.*has';
    const selectedGroup = escapeRegExp(this.expectedInputs().networkGroupSearch);

    for (const rightLabel of rightLabels) {
      const trigger = rights.getByRole('combobox', {
        name: new RegExp(escapeRegExp(rightLabel), 'i'),
      });
      await expect(trigger).toHaveCount(1, { timeout: CHECKPOINT_TIMEOUT_MS });
      await trigger.click();
      const incoming = this.page.getByRole('option', {
        name: new RegExp(
          `${incomingPrefix}.*${escapeRegExp(rightLabel)}.*in.*${selectedGroup}`,
          'i'
        ),
      });
      await expect(incoming).toHaveCount(1, { timeout: CHECKPOINT_TIMEOUT_MS });
      await incoming.click();
    }
  }

  private async selectCityDesignAddress() {
    await this.page.route(GEOAPIFY_SERVER_FN_PATTERN, async route => {
      const requestBody = route.request().postDataJSON() as { t?: unknown };
      const requestPayload = requestBody.t
        ? (fromCrossJSON(requestBody.t as Parameters<typeof fromCrossJSON>[0], {
            plugins: [],
          }) as { data?: { field?: string } })
        : null;
      const field = requestPayload?.data?.field;
      const includesRegion = field !== 'country';
      const includesCity = includesRegion && field !== 'region';
      const includesPostcode = includesCity && field !== 'city';
      const includesStreet = field === 'street' || field === 'house_number';
      const includesHouseNumber = field === 'house_number';
      const searchResult = {
        ...TUTORIAL_ADDRESS,
        state: includesRegion ? TUTORIAL_ADDRESS.state : undefined,
        city: includesCity ? TUTORIAL_ADDRESS.city : undefined,
        postcode: includesPostcode ? TUTORIAL_ADDRESS.postcode : undefined,
        street: includesStreet ? TUTORIAL_ADDRESS.street : undefined,
        housenumber: includesHouseNumber ? TUTORIAL_ADDRESS.housenumber : undefined,
        result_type: field ?? TUTORIAL_ADDRESS.result_type,
      };
      const payload = await toCrossJSONAsync({
        result: { results: [searchResult] },
        error: undefined,
        context: Object.create(null) as Record<string, never>,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'x-tss-serialized': 'true' },
        body: JSON.stringify(payload),
      });
    });

    try {
      const locationSearch = this.page.locator(
        '[data-tutorial-anchor="city-design-location-search"]'
      );
      await expect(locationSearch).toHaveAttribute('data-location-search-ready', 'true', {
        timeout: CHECKPOINT_TIMEOUT_MS,
      });
      await expect(async () => {
        const street = this.page.locator('#city-design-location-search-street');
        await street.fill(TUTORIAL_ADDRESS.street.slice(0, -1));
        const streetOption = this.page
          .locator('[role="option"]')
          .filter({ hasText: TUTORIAL_ADDRESS.street, visible: true });
        await expect(streetOption).toHaveCount(1, { timeout: 8_000 });
        await expect(streetOption).toBeVisible({ timeout: 8_000 });
        await streetOption.click();
        await expect(street).toHaveValue(TUTORIAL_ADDRESS.street, {
          timeout: 8_000,
        });

        const houseNumber = this.page.locator('#city-design-location-search-house-number');
        await houseNumber.fill(TUTORIAL_ADDRESS.housenumber.slice(0, 1));
        const houseOption = this.page
          .locator('[role="option"]')
          .filter({ hasText: TUTORIAL_ADDRESS.housenumber, visible: true });
        await expect(houseOption).toHaveCount(1, { timeout: 8_000 });
        await expect(houseOption).toBeVisible({ timeout: 8_000 });
        await houseOption.click();
      }).toPass({
        timeout: CHECKPOINT_TIMEOUT_MS,
        intervals: [250, 500, 1_000, 2_000],
      });
    } finally {
      await this.page.unroute(GEOAPIFY_SERVER_FN_PATTERN);
    }
  }

  private async addTreeRow() {
    const canvas = this.page.locator(
      '[data-tutorial-anchor="city-design-map-canvas"]:visible canvas'
    );
    await expect(canvas).toHaveCount(1, { timeout: CHECKPOINT_TIMEOUT_MS });
    await expect(canvas).toBeVisible({ timeout: CHECKPOINT_TIMEOUT_MS });
    const box = await canvas.boundingBox();
    if (!box) throw new Error('The City Design canvas has no bounding box.');

    await canvas.click({
      position: { x: box.width * 0.35, y: box.height * 0.55 },
    });
    await canvas.click({
      position: { x: box.width * 0.65, y: box.height * 0.55 },
    });
    await this.page.keyboard.press('Enter');
  }

  private async moveTutorialTodo(
    todoAnchor: 'tutorial-network-todo' | 'tutorial-assistant-todo',
    status: 'completed' | 'in_progress'
  ) {
    const source = this.page.locator(`[data-tutorial-anchor="${todoAnchor}"]:visible`);
    const destination = this.page.locator(`[data-todo-status="${status}"]:visible`);
    await expect(source).toHaveCount(1, { timeout: CHECKPOINT_TIMEOUT_MS });
    await expect(destination).toHaveCount(1, { timeout: CHECKPOINT_TIMEOUT_MS });
    await expect(source).toBeVisible({ timeout: CHECKPOINT_TIMEOUT_MS });
    await expect(destination).toBeVisible({
      timeout: CHECKPOINT_TIMEOUT_MS,
    });
    await source.dragTo(destination);
  }

  private async enterVotingPassword() {
    const inputs = this.page.locator(
      `[data-tutorial-anchor="${this.activeCheckpointId.includes('election') ? 'agenda-election-password' : 'agenda-amendment-password'}"]:visible input`
    );
    await expect(inputs).toHaveCount(4);
    const inputLocators = await inputs.all();
    for (const [input, digit] of inputLocators.map(
      (input, index) => [input, this.expectedInputs().votingPassword[index] ?? ''] as const
    )) {
      await input.fill(digit);
    }
  }

  private async sendAssistantRequest() {
    const composer = await this.unique(
      this.page.locator('[data-tutorial-anchor="message-composer"]:visible')
    );
    const input = composer.locator('textarea:visible');
    await expect(input).toHaveCount(1, { timeout: CHECKPOINT_TIMEOUT_MS });
    await expect(input).toBeVisible({ timeout: CHECKPOINT_TIMEOUT_MS });
    await input.fill(this.expectedInputs().assistantTodo);
    await composer.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
  }

  private async performCheckpoint(checkpoint: AppTutorialCheckpoint) {
    switch (checkpoint.id) {
      case 'open-search':
        await this.expectMobilePrimarySearchReachable(checkpoint);
        await this.clickTarget(checkpoint);
        return;
      case 'search-initiative':
        {
          const target = await this.unique(this.target(checkpoint));
          const control =
            (await target.evaluate(element => element.tagName)) === 'INPUT'
              ? target
              : target.locator('input:visible');
          await expect(control).toHaveCount(1);
          await control.fill(this.expectedInputs().groupSearch);
        }
        return;
      case 'link-climate-council':
        if (
          !(await visible(
            this.page.locator('[data-tutorial-anchor="network-group-search"]:visible input')
          ))
        ) {
          await this.target(checkpoint).evaluate(element => (element as HTMLElement).click());
          await this.page.evaluate(
            () =>
              new Promise<void>(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
              })
          );
        }
        await this.selectTypeahead(
          'network-group-search',
          this.expectedInputs().networkGroupSearch
        );
        return;
      case 'select-climate-council-rights':
        await this.selectNetworkRights();
        return;
      case 'request-climate-council-rights':
        await this.requestNetworkRights();
        return;
      case 'complete-network-todo':
        await this.moveTutorialTodo('tutorial-network-todo', 'completed');
        return;
      case 'edit-amendment-text':
        await this.appendEditorText(this.expectedInputs().amendmentAddition);
        return;
      case 'select-city-design-address':
        await this.selectCityDesignAddress();
        return;
      case 'add-tree-row':
        await this.addTreeRow();
        return;
      case 'switch-suggest-internal':
        await this.switchEditorMode(/Internal Suggestions|Intern vorschlagen/i);
        return;
      case 'create-change-request':
        await this.appendEditorText(this.expectedInputs().changeRequestText, true);
        return;
      case 'switch-vote-internal':
        await this.switchEditorMode(/Internal Voting Mode|Intern abstimmen/i);
        return;
      case 'create-amendment-path':
        await this.selectTypeahead(checkpoint.anchor, this.expectedInputs().groupSearch);
        return;
      case 'select-amendment-path-target':
        await this.selectTypeahead(checkpoint.anchor, this.expectedInputs().networkGroupSearch);
        return;
      case 'submit-amendment-vote':
      case 'submit-election-vote':
        await this.enterVotingPassword();
        return;
      case 'ask-assistant-for-todo':
        await this.sendAssistantRequest();
        return;
      case 'start-assistant-todo':
        await this.moveTutorialTodo('tutorial-assistant-todo', 'in_progress');
        return;
      default:
        if (checkpoint.completion.type === 'horizontal-scroll') {
          await this.completeHorizontalScroll(checkpoint);
          return;
        }
        if (checkpoint.completion.type === 'view' || checkpoint.completion.type === 'acknowledge') {
          await this.clickContinue(checkpoint);
          return;
        }
        await this.clickTarget(checkpoint);
    }
  }
}

declare global {
  interface Window {
    __e2eClipboardText?: string;
  }
}
