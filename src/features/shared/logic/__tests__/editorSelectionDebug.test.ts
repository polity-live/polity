/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  editorSelectionDebugLog,
  getActiveElementDebugInfo,
  isActiveElementInSlateEditor,
  summarizeDiscussion,
  summarizeDiscussions,
  summarizeRichTextValue,
  summarizeSelection,
} from '../editorSelectionDebug';

describe('editor selection debug summaries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('keeps the debug logger inert with explicit and default data', () => {
    expect(editorSelectionDebugLog('event')).toBeUndefined();
    expect(editorSelectionDebugLog('event', { value: 1 })).toBeUndefined();
  });

  it('summarizes primitive and fully populated discussions', () => {
    expect(summarizeDiscussion(null)).toMatchObject({ valueType: 'object', id: null });
    expect(summarizeDiscussion('text')).toMatchObject({ valueType: 'string', id: null });
    expect(
      summarizeDiscussion({
        id: 'discussion',
        crId: 'CR-1',
        changeRequestEntityId: 'change-request',
        changeRequestStatus: 'accepted',
        confirmationStatus: 'confirmed',
        status: 'resolved',
        votingStatus: 'closed',
        comments: [{ id: 'comment' }],
        votesFor: 2,
        votesAgainst: 1,
        votesAbstain: 0,
      })
    ).toEqual({
      id: 'discussion',
      crId: 'CR-1',
      changeRequestEntityId: 'change-request',
      changeRequestStatus: 'accepted',
      confirmationStatus: 'confirmed',
      status: 'resolved',
      votingStatus: 'closed',
      commentCount: 1,
      votesFor: 2,
      votesAgainst: 1,
      votesAbstain: 0,
      valueType: 'object',
    });
    expect(summarizeDiscussion({ comments: null, votesFor: '2' })).toMatchObject({
      commentCount: null,
      votesFor: null,
    });
  });

  it('summarizes absent and large discussion lists with relationship counts', () => {
    expect(summarizeDiscussions(null)).toEqual({ count: 0, items: [], type: 'object' });
    const discussions = Array.from({ length: 30 }, (_, index) => ({
      id: `discussion-${index}`,
      crId: index < 2 ? `CR-${index}` : null,
      changeRequestEntityId: index === 0 ? 'change-request' : null,
    }));
    expect(summarizeDiscussions(discussions)).toMatchObject({
      count: 30,
      missingChangeRequestEntityCount: 1,
      withChangeRequestEntityCount: 1,
    });
    expect((summarizeDiscussions(discussions) as { items: unknown[] }).items).toHaveLength(25);
  });

  it('summarizes absent, primitive, collapsed, and expanded selections', () => {
    expect(summarizeSelection(null)).toBeNull();
    expect(summarizeSelection('selection')).toEqual({ type: 'string' });
    expect(
      summarizeSelection({
        anchor: { offset: 2, path: [0, 'invalid', 1] },
        focus: { offset: 2, path: [0, 1] },
      })
    ).toMatchObject({ isCollapsed: true, anchor: { offset: 2, path: [0, 1] } });
    expect(
      summarizeSelection({ anchor: { offset: '2', path: null }, focus: undefined })
    ).toMatchObject({
      anchor: { offset: null, path: null },
      focus: null,
      isCollapsed: false,
    });
  });

  it('collects nested rich-text counts and root fallbacks', () => {
    expect(summarizeRichTextValue(null)).toMatchObject({
      rootBlockCount: 0,
      nodeCount: 0,
      firstRootType: null,
      lastRootType: null,
    });
    expect(
      summarizeRichTextValue([
        null,
        { type: 'p', children: [{ text: 'Hello' }, { text: '' }, 'invalid'] },
        { children: [] },
      ])
    ).toMatchObject({
      rootBlockCount: 3,
      nodeCount: 4,
      maxDepth: 2,
      textLeafCount: 2,
      textLength: 5,
      firstRootType: 'unknown',
      lastRootType: 'unknown',
      rootTypes: ['unknown', 'p', 'unknown'],
      typeCounts: { p: 1 },
    });
    const manyRoots = Array.from({ length: 15 }, (_, index) => ({ type: `type-${index}` }));
    expect((summarizeRichTextValue(manyRoots) as { rootTypes: string[] }).rootTypes).toHaveLength(
      12
    );
  });

  it('returns null/false without browser globals', () => {
    vi.stubGlobal('document', undefined);
    expect(getActiveElementDebugInfo()).toBeNull();
    expect(isActiveElementInSlateEditor()).toBe(false);
    vi.unstubAllGlobals();

    vi.stubGlobal('HTMLElement', undefined);
    expect(getActiveElementDebugInfo()).toBeNull();
    expect(isActiveElementInSlateEditor()).toBe(false);
  });

  it('describes focused HTML elements inside and outside Slate editors', () => {
    expect(getActiveElementDebugInfo()).toMatchObject({ id: null, tagName: 'body' });
    document.body.innerHTML = `
      <div data-slate-editor="true">
        <button id="inside" class="button" role="textbox" data-slate-node="element">Inside</button>
      </div>
      <button id="outside">Outside</button>
    `;
    const inside = document.querySelector<HTMLButtonElement>('#inside')!;
    inside.focus();
    expect(getActiveElementDebugInfo()).toMatchObject({
      id: 'inside',
      className: 'button',
      dataSlateEditor: null,
      dataSlateNode: 'element',
      isInSlateEditor: true,
      role: 'textbox',
      tagName: 'button',
    });
    expect(isActiveElementInSlateEditor()).toBe(true);

    const outside = document.querySelector<HTMLButtonElement>('#outside')!;
    Object.defineProperty(outside, 'className', { configurable: true, value: {} });
    outside.focus();
    expect(getActiveElementDebugInfo()).toMatchObject({ id: 'outside', className: null });
    expect(isActiveElementInSlateEditor()).toBe(false);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => svg,
    });
    expect(getActiveElementDebugInfo()).toBeNull();
    expect(isActiveElementInSlateEditor()).toBe(false);
    Reflect.deleteProperty(document, 'activeElement');
  });
});
