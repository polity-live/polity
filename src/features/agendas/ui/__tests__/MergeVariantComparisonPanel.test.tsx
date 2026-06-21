/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  MergeVariantComparisonPanel,
  VariantDiffPanel,
  type MergeVariantCandidate,
} from '../MergeVariantComparisonPanel';

const editorMocks = vi.hoisted(() => {
  const readText = (value: unknown): string => {
    if (!Array.isArray(value)) return '';

    return value
      .map(node =>
        Array.isArray((node as { children?: unknown }).children)
          ? ((node as { children: { text?: string }[] }).children ?? [])
              .map(child => child.text ?? '')
              .join('')
          : ''
      )
      .join('\n');
  };

  return {
    createSlateEditor: vi.fn(({ value }: { value: unknown }) => ({
      previewText: readText(value),
      value,
    })),
  };
});

vi.mock('platejs', () => ({
  createSlateEditor: editorMocks.createSlateEditor,
}));

vi.mock('@/features/shared/ui/kit-platejs/editor-base-kit', () => ({
  BaseEditorKit: [],
}));

vi.mock('@/features/shared/ui/ui-platejs/editor-static', () => ({
  EditorStatic: ({ editor }: { editor?: { previewText?: string } }) => (
    <div data-testid="editor-static">{editor?.previewText ?? ''}</div>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, paramsOrFallback?: string | Record<string, unknown>) =>
    typeof paramsOrFallback === 'string' ? paramsOrFallback : _key,
}));

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.setPointerCapture ??= () => undefined;
  HTMLElement.prototype.releasePointerCapture ??= () => undefined;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function content(text: string) {
  return [{ type: 'p', children: [{ text }] }];
}

function buildCandidates(): MergeVariantCandidate[] {
  return [
    {
      id: 'variant-1',
      label: 'Antrag 1',
      groupName: 'B1',
      content: content(
        ['A6', 'test1: Dieser Text soll entfernt werden', 'test2 bleibt'].join('\n')
      ),
    },
    {
      id: 'variant-2',
      label: 'Antrag 2',
      groupName: 'B1',
      content: content(
        ['A6', 'test3: Dieser Text soll hinzugefügt werden', 'test2 bleibt'].join('\n')
      ),
    },
    {
      id: 'variant-3',
      label: 'Antrag 3',
      groupName: 'B2',
      content: content(['A6', 'test4: Weitere Fassung', 'test2 bleibt'].join('\n')),
    },
  ];
}

function openSelect(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
}

function openDiffTab() {
  const diffTab = screen.getByRole('tab', { name: 'Diff' });

  fireEvent.mouseDown(diffTab, { button: 0, ctrlKey: false });
  fireEvent.click(diffTab);
}

describe('MergeVariantComparisonPanel', () => {
  it('renders the selected variants side by side on desktop', () => {
    render(<MergeVariantComparisonPanel candidates={buildCandidates()} />);

    const grid = screen.getByTestId('merge-variant-grid');

    expect(grid.className).toContain('lg:grid-cols-2');
    expect(screen.getByTestId('merge-variant-left-select').textContent).toContain('Antrag 1');
    expect(screen.getByTestId('merge-variant-right-select').textContent).toContain('Antrag 2');
    expect(screen.getByTestId('merge-variant-left-preview').textContent).toContain('Antrag 1');
    expect(screen.getByTestId('merge-variant-right-preview').textContent).toContain('Antrag 2');
    expect(within(grid).getByText('Antrag 1')).toBeTruthy();
    expect(within(grid).getByText('Antrag 2')).toBeTruthy();
    expect(within(grid).queryByText('Antrag 3')).toBeNull();
  });

  it('updates the selected variants and keeps both sides distinct', () => {
    render(<MergeVariantComparisonPanel candidates={buildCandidates()} />);

    openSelect(screen.getByTestId('merge-variant-right-select'));
    fireEvent.click(screen.getByRole('option', { name: 'Antrag 1' }));

    expect(screen.getByTestId('merge-variant-left-select').textContent).toContain('Antrag 2');
    expect(screen.getByTestId('merge-variant-right-select').textContent).toContain('Antrag 1');
    expect(screen.getByTestId('merge-variant-left-preview').textContent).toContain('Antrag 2');
    expect(screen.getByTestId('merge-variant-right-preview').textContent).toContain('Antrag 1');
  });

  it('uses the selected variant pair in the git-style line diff', () => {
    render(<MergeVariantComparisonPanel candidates={buildCandidates()} />);

    openSelect(screen.getByTestId('merge-variant-right-select'));
    fireEvent.click(screen.getByRole('option', { name: 'Antrag 3' }));
    openDiffTab();

    expect(screen.getByTestId('merge-variant-left-select').textContent).toContain('Antrag 1');
    expect(screen.getByTestId('merge-variant-right-select').textContent).toContain('Antrag 3');
    expect(screen.getAllByTestId('merge-variant-diff-row-context')[0].textContent).toContain('A6');
    expect(screen.getByTestId('merge-variant-diff-row-remove').textContent).toContain('-');
    expect(screen.getByTestId('merge-variant-diff-row-remove').textContent).toContain(
      'test1: Dieser Text soll entfernt werden'
    );
    expect(screen.getByTestId('merge-variant-diff-row-add').textContent).toContain('+');
    expect(screen.getByTestId('merge-variant-diff-row-add').textContent).toContain(
      'test4: Weitere Fassung'
    );
    expect(screen.getByTestId('merge-variant-diff-row-remove').textContent).toContain('2');
    expect(screen.getByTestId('merge-variant-diff-row-add').textContent).toContain('2');
  });

  it('shows an empty state when the selected variants have no line differences', () => {
    render(
      <MergeVariantComparisonPanel
        candidates={[
          { id: 'same-1', label: 'Antrag 1', content: content('A6\nsame') },
          { id: 'same-2', label: 'Antrag 2', content: content('A6\nsame') },
        ]}
      />
    );

    openDiffTab();

    expect(screen.getByTestId('merge-variant-no-diff').textContent).toContain('Keine Unterschiede');
  });
});

describe('VariantDiffPanel', () => {
  it('defaults to original document versus winning branch when candidates are marked', () => {
    render(
      <VariantDiffPanel
        candidates={[
          {
            id: 'original',
            label: 'Ursprungsdokument',
            content: content('Original'),
            isOriginal: true,
          },
          {
            id: 'branch-loser',
            label: 'Branch loser',
            content: content('Loser'),
          },
          {
            id: 'branch-winner',
            label: 'Branch winner',
            content: content('Winner'),
            isWinner: true,
          },
        ]}
        defaultLeftCandidateId="original"
      />
    );

    expect(screen.getByTestId('merge-variant-left-select').textContent).toContain(
      'Ursprungsdokument'
    );
    expect(screen.getByTestId('merge-variant-right-select').textContent).toContain('Branch winner');
    expect(screen.getByTestId('merge-variant-left-preview').textContent).toContain(
      'Ursprungsdokument'
    );
    expect(screen.getByTestId('merge-variant-right-preview').textContent).toContain(
      'Branch winner'
    );
  });
});
