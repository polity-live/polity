/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertBlock: vi.fn(),
  insertInlineElement: vi.fn(),
  openDataViewDialog: vi.fn(),
  showAi: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/kit-platejs/transforms.ts', () => ({
  insertBlock: mocks.insertBlock,
  insertInlineElement: mocks.insertInlineElement,
}));

vi.mock('@/features/charts/ui/ChartDialog', () => ({
  openDataViewDialog: mocks.openDataViewDialog,
}));

vi.mock('platejs/react', () => ({
  PlateElement: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/features/shared/ui/rich-text', () => ({
  InlineCombobox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InlineComboboxContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InlineComboboxEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InlineComboboxGroup: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  InlineComboboxGroupLabel: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  InlineComboboxInput: () => <input aria-label="slash search" />,
  InlineComboboxItem: ({
    children,
    focusEditor,
    group,
    keywords,
    label,
    onClick,
    value,
  }: ComponentProps<'button'> & {
    focusEditor?: boolean;
    group: string;
    keywords?: string[];
    label: string;
    value: string;
  }) => (
    <button
      type="button"
      aria-label={value}
      data-focus-editor={String(focusEditor)}
      data-group={group}
      data-keywords={keywords?.join(',')}
      data-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

vi.mock('@platejs/ai/react', () => ({
  AIChatPlugin: { key: 'aiChat' },
}));

import { DATA_VIEW_NODE_TYPE } from '@/features/charts/types';
import { KEYS } from 'platejs';
import { SlashInputElement } from '../slash-node';

describe('SlashInputElement branch campaign A01', () => {
  const editor = {
    getApi: () => ({ aiChat: { show: mocks.showAi } }),
  } as never;
  const slashProps = {
    editor,
    element: { children: [{ text: '' }], type: 'slash' },
    children: 'slash child',
  } as unknown as Parameters<typeof SlashInputElement>[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders every supported group and translated command with semantic metadata', () => {
    render(<SlashInputElement {...slashProps} />);

    expect(screen.getByText('commandDialog.noResults')).toBeTruthy();
    expect(screen.getByText('slash child')).toBeTruthy();
    expect(screen.getAllByRole('heading').map(heading => heading.textContent)).toEqual([
      'plateJs.toolbar.groups.ai',
      'plateJs.toolbar.groups.basicBlocks',
      'plateJs.toolbar.groups.advancedBlocks',
      'plateJs.toolbar.groups.inline',
    ]);

    const commands = screen.getAllByRole('button');
    expect(commands).toHaveLength(19);
    expect(screen.getByRole('button', { name: 'AI' }).dataset.focusEditor).toBe('false');
    expect(screen.getByRole('button', { name: KEYS.date }).dataset.focusEditor).toBe('true');
    expect(screen.getByRole('button', { name: KEYS.p }).dataset.keywords).toBe('paragraph');
    expect(screen.getByRole('button', { name: DATA_VIEW_NODE_TYPE }).dataset.label).toBe(
      'plateJs.dataView.insertTitle'
    );
  });

  it('dispatches block, inline, AI and data-view commands through their real UI actions', () => {
    render(<SlashInputElement {...slashProps} />);

    for (const value of [
      KEYS.p,
      KEYS.h1,
      KEYS.h2,
      KEYS.h3,
      KEYS.ul,
      KEYS.ol,
      KEYS.listTodo,
      KEYS.toggle,
      KEYS.codeBlock,
      KEYS.table,
      KEYS.blockquote,
      KEYS.callout,
      KEYS.toc,
      'action_three_columns',
      KEYS.equation,
    ]) {
      fireEvent.click(screen.getByRole('button', { name: value }));
    }

    for (const value of [KEYS.date, KEYS.inlineEquation]) {
      fireEvent.click(screen.getByRole('button', { name: value }));
    }

    fireEvent.click(screen.getByRole('button', { name: 'AI' }));
    fireEvent.click(screen.getByRole('button', { name: DATA_VIEW_NODE_TYPE }));

    expect(mocks.insertBlock.mock.calls.map(([, value]) => value)).toEqual([
      KEYS.p,
      KEYS.h1,
      KEYS.h2,
      KEYS.h3,
      KEYS.ul,
      KEYS.ol,
      KEYS.listTodo,
      KEYS.toggle,
      KEYS.codeBlock,
      KEYS.table,
      KEYS.blockquote,
      KEYS.callout,
      KEYS.toc,
      'action_three_columns',
      KEYS.equation,
    ]);
    expect(mocks.insertInlineElement.mock.calls.map(([, value]) => value)).toEqual([
      KEYS.date,
      KEYS.inlineEquation,
    ]);
    expect(mocks.showAi).toHaveBeenCalledTimes(1);
    expect(mocks.openDataViewDialog).toHaveBeenCalledTimes(1);
  });
});
