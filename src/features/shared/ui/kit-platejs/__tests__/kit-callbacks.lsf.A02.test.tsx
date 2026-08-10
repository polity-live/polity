/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('platejs', () => ({
  KEYS: { codeBlock: 'code-block' },
  createSlatePlugin: (config: unknown) => config,
  createTextSubstitutionInputRule: (config: unknown) => config,
}));
vi.mock('platejs/react', () => ({ createPlatePlugin: (config: unknown) => config }));
vi.mock('@platejs/selection/react', () => ({
  CursorOverlayPlugin: { configure: (config: unknown) => config },
}));
vi.mock('@platejs/slash-command/react', () => ({
  SlashPlugin: { configure: (config: unknown) => config },
  SlashInputPlugin: { withComponent: (component: unknown) => ({ component }) },
}));
vi.mock('../basic-blocks-kit.tsx', () => ({ BasicBlocksKit: ['block'] }));
vi.mock('../basic-marks-kit.tsx', () => ({ BasicMarksKit: ['mark'] }));
vi.mock('@/features/shared/ui/ui-platejs/cursor-overlay.tsx', () => ({
  CursorOverlay: () => <div>cursor overlay</div>,
}));
vi.mock('@/features/shared/ui/ui-platejs/floating-toolbar.tsx', () => ({
  FloatingToolbar: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui-platejs/floating-toolbar-buttons.tsx', () => ({
  FloatingToolbarButtons: () => <div>floating buttons</div>,
}));
vi.mock('@/features/shared/ui/ui-platejs/slash-node.tsx', () => ({
  SlashInputElement: () => <div>slash</div>,
}));

import { AutoformatKit, isAutoformatRuleEnabled } from '../autoformat-kit';
import { BasicNodesKit } from '../basic-nodes-kit';
import { CursorOverlayKit } from '../cursor-overlay-kit';
import { FloatingToolbarKit } from '../floating-toolbar-kit';
import { SlashKit } from '../slash-kit';

afterEach(cleanup);

describe('A02 Plate kit callback contracts', () => {
  it('executes every configured editor callback', () => {
    const editor = {
      api: { some: vi.fn(() => false) },
      getType: vi.fn((key: string) => key),
    };
    expect(isAutoformatRuleEnabled({ editor })).toBe(true);

    const autoformat = AutoformatKit[0] as any;
    expect(autoformat.inputRules[0].enabled({ editor })).toBe(true);
    const slash = SlashKit[0] as any;
    expect(slash.options.triggerQuery(editor)).toBe(true);

    const cursor = (CursorOverlayKit[0] as any).render.afterEditable();
    const floating = (FloatingToolbarKit[0] as any).render.afterEditable();
    render(
      <>
        {cursor}
        {floating}
      </>
    );
    expect(screen.getByText('cursor overlay')).toBeTruthy();
    expect(screen.getByText('floating buttons')).toBeTruthy();
    expect(BasicNodesKit).toEqual(['block', 'mark']);
  });
});
