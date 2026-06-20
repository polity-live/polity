/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import {
  applyChangeRequestMotionDelays,
  getChangeRequestMotionDurationMs,
  shouldUpdateChangeRequestMotionForMutations,
} from '../changeRequestMotion';

const MOTION_DELAY_PROPERTY = '--change-request-motion-delay';

function createScope(html: string) {
  const scope = document.createElement('div');
  scope.innerHTML = html;
  return scope;
}

async function collectMutationRecords(
  scope: HTMLElement,
  mutate: () => void
): Promise<MutationRecord[]> {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver(mutations => records.push(...mutations));

  observer.observe(scope, {
    attributeFilter: ['data-suggestion-id', 'data-suggestion-ids'],
    attributes: true,
    childList: true,
    subtree: true,
  });

  mutate();
  await new Promise(resolve => setTimeout(resolve, 0));
  observer.disconnect();

  return records;
}

describe('change request motion helpers', () => {
  it('calculates the initial animation window for multiple change requests', () => {
    expect(getChangeRequestMotionDurationMs(3)).toBe(3260);
  });

  it('uses a fallback capture window when no change requests rendered yet', () => {
    expect(getChangeRequestMotionDurationMs(0)).toBe(1000);
  });

  it('ignores cursor and selection overlay mutations', async () => {
    const scope = createScope('<p><ins data-suggestion-id="cr-a">A</ins></p>');

    const records = await collectMutationRecords(scope, () => {
      const cursorOverlay = document.createElement('div');
      cursorOverlay.className = 'slate-cursor-overlay';
      cursorOverlay.innerHTML = '<span style="position:absolute"></span>';
      scope.append(cursorOverlay);
    });

    expect(records.length).toBeGreaterThan(0);
    expect(shouldUpdateChangeRequestMotionForMutations(records)).toBe(false);
  });

  it('does not rewrite styles when the suggestion signature is unchanged', () => {
    const scope = createScope(`
      <p><ins data-suggestion-id="cr-a">A</ins></p>
      <button data-suggestion-ids="cr-a">1</button>
    `);

    const first = applyChangeRequestMotionDelays(scope);
    const second = applyChangeRequestMotionDelays(scope, first.signature);

    expect(first.didChange).toBe(true);
    expect(first.totalDurationMs).toBe(860);
    expect(first.updatedElementCount).toBe(2);
    expect(second.didChange).toBe(false);
    expect(second.totalDurationMs).toBe(860);
    expect(second.updatedElementCount).toBe(0);
    expect(
      scope.querySelector<HTMLElement>('ins')?.style.getPropertyValue(MOTION_DELAY_PROPERTY)
    ).toBe('0ms');
  });

  it('assigns a delay to newly inserted change request markers', () => {
    const scope = createScope('<p><ins data-suggestion-id="cr-a">A</ins></p>');

    const first = applyChangeRequestMotionDelays(scope);
    const newMarker = document.createElement('ins');
    newMarker.dataset.suggestionId = 'cr-b';
    newMarker.textContent = 'B';
    scope.append(newMarker);

    const second = applyChangeRequestMotionDelays(scope, first.signature);

    expect(second.didChange).toBe(true);
    expect(second.updatedElementCount).toBe(1);
    expect(newMarker.style.getPropertyValue(MOTION_DELAY_PROPERTY)).toBe('1200ms');
  });

  it('treats removed suggestion attributes as motion changes', async () => {
    const scope = createScope('<p><ins data-suggestion-id="cr-a">A</ins></p>');
    const marker = scope.querySelector<HTMLElement>('ins');

    const records = await collectMutationRecords(scope, () => {
      marker?.removeAttribute('data-suggestion-id');
    });

    expect(shouldUpdateChangeRequestMotionForMutations(records)).toBe(true);
  });
});
