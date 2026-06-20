const CHANGE_REQUEST_MOTION_STEP_MS = 1200;
const CHANGE_REQUEST_MOTION_ANIMATION_MS = 760;
const CHANGE_REQUEST_MOTION_BUFFER_MS = 100;
const EMPTY_CHANGE_REQUEST_MOTION_CAPTURE_MS = 1000;
const MOTION_DELAY_PROPERTY = '--change-request-motion-delay';
const SUGGESTION_MARK_SELECTOR = '[data-suggestion-id]';
const SUGGESTION_BUTTON_SELECTOR = 'button[data-suggestion-ids]';
const MOTION_ELEMENT_SELECTOR = `${SUGGESTION_MARK_SELECTOR}, ${SUGGESTION_BUTTON_SELECTOR}`;
const SIGNATURE_SEPARATOR = '\u001f';
const DOCUMENT_POSITION_PRECEDING = 2;
const DOCUMENT_POSITION_FOLLOWING = 4;
const MOTION_ATTRIBUTE_NAMES = new Set(['data-suggestion-id', 'data-suggestion-ids']);

export interface ChangeRequestMotionResult {
  didChange: boolean;
  signature: string;
  suggestionCount: number;
  totalDurationMs: number;
  updatedElementCount: number;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function isMotionElement(element: Element): boolean {
  return element.matches(MOTION_ELEMENT_SELECTOR);
}

function nodeContainsMotionElement(node: Node): boolean {
  if (!isElement(node)) return false;
  return isMotionElement(node) || Boolean(node.querySelector(MOTION_ELEMENT_SELECTOR));
}

function mutationTargetsMotionElement(mutation: MutationRecord): boolean {
  if (mutation.type === 'attributes') {
    return isElement(mutation.target) && MOTION_ATTRIBUTE_NAMES.has(mutation.attributeName ?? '');
  }

  if (mutation.type !== 'childList') {
    return false;
  }

  return [...mutation.addedNodes, ...mutation.removedNodes].some(nodeContainsMotionElement);
}

export function shouldUpdateChangeRequestMotionForMutations(
  mutations: readonly MutationRecord[]
): boolean {
  return mutations.some(mutationTargetsMotionElement);
}

function compareDocumentOrder(a: Element, b: Element): number {
  const position = a.compareDocumentPosition(b);

  if (position & DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }

  if (position & DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }

  return 0;
}

function splitSuggestionIds(value: string | null | undefined): string[] {
  return value?.split(/\s+/).filter(Boolean) ?? [];
}

function collectMotionElements(scope: ParentNode) {
  const suggestionOrder = new Map<string, number>();
  const motionElements = Array.from(
    scope.querySelectorAll<HTMLElement>(MOTION_ELEMENT_SELECTOR)
  ).sort(compareDocumentOrder);

  const registerSuggestionId = (suggestionId: string | null | undefined) => {
    if (!suggestionId || suggestionOrder.has(suggestionId)) {
      return;
    }

    suggestionOrder.set(suggestionId, suggestionOrder.size);
  };

  motionElements.forEach(element => {
    registerSuggestionId(element.dataset.suggestionId);
    splitSuggestionIds(element.getAttribute('data-suggestion-ids')).forEach(registerSuggestionId);
  });

  return {
    motionElements,
    signature: [...suggestionOrder.keys()].join(SIGNATURE_SEPARATOR),
    suggestionOrder,
  };
}

function setMotionDelay(element: HTMLElement, order: number): boolean {
  const value = `${order * CHANGE_REQUEST_MOTION_STEP_MS}ms`;

  if (element.style.getPropertyValue(MOTION_DELAY_PROPERTY) === value) {
    return false;
  }

  element.style.setProperty(MOTION_DELAY_PROPERTY, value);
  return true;
}

function getButtonMotionOrder(element: HTMLElement, suggestionOrder: Map<string, number>) {
  const orders = splitSuggestionIds(element.getAttribute('data-suggestion-ids'))
    .map(suggestionId => suggestionOrder.get(suggestionId))
    .filter((order): order is number => order != null);

  if (orders.length === 0) {
    return null;
  }

  return Math.min(...orders);
}

export function getChangeRequestMotionDurationMs(suggestionCount: number): number {
  if (suggestionCount <= 0) {
    return EMPTY_CHANGE_REQUEST_MOTION_CAPTURE_MS;
  }

  return (
    (suggestionCount - 1) * CHANGE_REQUEST_MOTION_STEP_MS +
    CHANGE_REQUEST_MOTION_ANIMATION_MS +
    CHANGE_REQUEST_MOTION_BUFFER_MS
  );
}

export function applyChangeRequestMotionDelays(
  scope: ParentNode,
  previousSignature?: string
): ChangeRequestMotionResult {
  const { motionElements, signature, suggestionOrder } = collectMotionElements(scope);
  const totalDurationMs = getChangeRequestMotionDurationMs(suggestionOrder.size);

  if (signature === previousSignature) {
    return {
      didChange: false,
      signature,
      suggestionCount: suggestionOrder.size,
      totalDurationMs,
      updatedElementCount: 0,
    };
  }

  let updatedElementCount = 0;

  motionElements.forEach(element => {
    const suggestionId = element.dataset.suggestionId;
    const markOrder = suggestionId ? suggestionOrder.get(suggestionId) : undefined;
    const order = markOrder ?? getButtonMotionOrder(element, suggestionOrder);

    if (order == null) {
      return;
    }

    if (setMotionDelay(element, order)) {
      updatedElementCount++;
    }
  });

  return {
    didChange: true,
    signature,
    suggestionCount: suggestionOrder.size,
    totalDurationMs,
    updatedElementCount,
  };
}
