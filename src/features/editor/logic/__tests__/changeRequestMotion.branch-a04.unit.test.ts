/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';

import {
  applyChangeRequestMotionDelays,
  shouldUpdateChangeRequestMotionForMutations,
} from '../changeRequestMotion';

function mutation(overrides: Partial<MutationRecord>): MutationRecord {
  return {
    addedNodes: [] as unknown as NodeList,
    attributeName: null,
    attributeNamespace: null,
    nextSibling: null,
    oldValue: null,
    previousSibling: null,
    removedNodes: [] as unknown as NodeList,
    target: document.createElement('div'),
    type: 'childList',
    ...overrides,
  };
}

describe('change request motion remaining branches', () => {
  it('rejects non-motion nodes, unrelated mutation types, and missing attribute names', () => {
    expect(
      shouldUpdateChangeRequestMotionForMutations([
        mutation({ addedNodes: [document.createTextNode('plain')] as unknown as NodeList }),
      ])
    ).toBe(false);
    expect(shouldUpdateChangeRequestMotionForMutations([mutation({ type: 'characterData' })])).toBe(
      false
    );
    expect(shouldUpdateChangeRequestMotionForMutations([mutation({ type: 'attributes' })])).toBe(
      false
    );
  });

  it('covers preceding, equal, empty-button, and unchanged-style ordering outcomes', () => {
    const preceding = document.createElement('ins');
    preceding.dataset.suggestionId = 'preceding';
    const equal = document.createElement('ins');
    equal.dataset.suggestionId = 'equal';
    const emptyButton = document.createElement('button');
    emptyButton.setAttribute('data-suggestion-ids', '');
    const scope = {
      querySelectorAll: vi.fn(() => [preceding, equal, emptyButton]),
    } as unknown as ParentNode;

    vi.spyOn(preceding, 'compareDocumentPosition').mockReturnValue(
      Node.DOCUMENT_POSITION_PRECEDING
    );
    vi.spyOn(equal, 'compareDocumentPosition').mockReturnValue(0);

    const first = applyChangeRequestMotionDelays(scope);
    const second = applyChangeRequestMotionDelays(scope, 'force-a-second-pass');

    expect(first.updatedElementCount).toBe(2);
    expect(second.updatedElementCount).toBe(0);
    expect(emptyButton.style.getPropertyValue('--change-request-motion-delay')).toBe('');
  });
});
