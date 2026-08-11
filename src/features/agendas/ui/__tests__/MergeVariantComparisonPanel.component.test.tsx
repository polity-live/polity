/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  MergeVariantComparisonPanel,
  VariantDiffPanel,
  mergeVariantComparisonTestApi,
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

vi.mock('@/features/shared/hooks/use-translation', () => {
  const labels: Record<string, string> = {
    'features.agendas.mergeComparison.baseVariant': 'Basisvariante',
    'features.agendas.mergeComparison.badgeLabel': 'Vergleich',
    'features.agendas.mergeComparison.comparisonVariant': 'Vergleichsvariante',
    'features.agendas.mergeComparison.diff': 'Diff',
    'features.agendas.mergeComparison.new': 'Neu',
    'features.agendas.mergeComparison.noDifferences': 'Keine Unterschiede',
    'features.agendas.mergeComparison.old': 'Alt',
    'features.agendas.mergeComparison.title': 'Variantenvergleich',
    'features.agendas.mergeComparison.variants': 'Varianten',
  };

  return {
    translate: (key: string, paramsOrFallback?: string | Record<string, unknown>) =>
      typeof paramsOrFallback === 'string' ? paramsOrFallback : (labels[key] ?? key),
  };
});

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
    expect(screen.getByTestId('merge-variant-left-select').getAttribute('data-action-id')).toBe(
      'agendas.merge-comparison.left-variant.select'
    );
    expect(screen.getByTestId('merge-variant-right-select').getAttribute('data-action-id')).toBe(
      'agendas.merge-comparison.right-variant.select'
    );
    expect(screen.getByRole('tab', { name: 'Varianten' }).getAttribute('data-action-id')).toBe(
      'agendas.merge-comparison.tab.variants'
    );
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

    expect(screen.getByRole('tab', { name: 'Diff' }).getAttribute('data-action-id')).toBe(
      'agendas.merge-comparison.tab.diff'
    );

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

  it('renders no comparison until two content-bearing variants exist', () => {
    const { container, rerender } = render(<VariantDiffPanel candidates={[]} />);
    expect(container.textContent).toBe('');

    rerender(
      <VariantDiffPanel
        candidates={[
          { id: 'empty', label: 'Empty' },
          { id: 'only', label: 'Only', content: content('Only') },
        ]}
      />
    );
    expect(container.textContent).toBe('');
  });

  it('supports a comparison without a badge and both left-selection paths', () => {
    render(<VariantDiffPanel candidates={buildCandidates()} badgeLabel={null} />);
    expect(screen.queryByText('Vergleich')).toBeNull();

    openSelect(screen.getByTestId('merge-variant-left-select'));
    fireEvent.click(screen.getByRole('option', { name: 'Antrag 3' }));
    expect(screen.getByTestId('merge-variant-left-select').textContent).toContain('Antrag 3');
    expect(screen.getByTestId('merge-variant-right-select').textContent).toContain('Antrag 1');

    openSelect(screen.getByTestId('merge-variant-left-select'));
    fireEvent.click(screen.getByRole('option', { name: 'Antrag 1' }));
    expect(screen.getByTestId('merge-variant-left-select').textContent).toContain('Antrag 1');
    expect(screen.getByTestId('merge-variant-right-select').textContent).toContain('Antrag 2');
  });
});

describe('merge comparison pure branches', () => {
  it('normalizes wrapped, malformed, primitive, and empty editor values', () => {
    const { normalizePlateValue, extractTextFromNode, extractPlainTextLines } =
      mergeVariantComparisonTestApi;
    const wrapped = content('wrapped');

    expect(normalizePlateValue({ content: wrapped })).toBe(wrapped);
    expect(normalizePlateValue({ content: 'invalid' })).toEqual(content(''));
    expect(normalizePlateValue(null)).toEqual(content(''));
    expect(normalizePlateValue('plain')).toEqual(content(''));
    expect(extractTextFromNode(null)).toBe('');
    expect(extractTextFromNode({})).toBe('');
    expect(
      extractTextFromNode({ children: [{ text: 'A' }, null, { children: [{ text: 'B' }] }] })
    ).toBe('AB');
    expect(extractPlainTextLines([])).toEqual(['']);
  });

  it('builds add-only diffs and resolves every candidate fallback', () => {
    const {
      buildUnifiedLineDiff,
      getFirstOtherCandidate,
      getDefaultLeftCandidate,
      getDefaultRightCandidate,
    } = mergeVariantComparisonTestApi;
    const candidates = [
      { id: 'original', label: 'Original', isOriginal: true, content: content('A') },
      { id: 'winner', label: 'Winner', isWinner: true, content: content('B') },
      { id: 'branch', label: 'Branch', content: content('C') },
    ];

    expect(buildUnifiedLineDiff([], ['added'])).toEqual([
      { kind: 'add', oldLineNumber: null, newLineNumber: 1, text: 'added' },
    ]);
    expect(getFirstOtherCandidate([{ id: 'same', label: 'Same' }], 'same')).toBeNull();
    expect(getDefaultLeftCandidate(candidates, 'winner')?.id).toBe('winner');
    expect(getDefaultLeftCandidate(candidates, 'missing')?.id).toBe('original');
    expect(getDefaultLeftCandidate(candidates.filter(candidate => !candidate.isOriginal))?.id).toBe(
      'winner'
    );
    expect(getDefaultLeftCandidate([])).toBeNull();
    expect(getDefaultRightCandidate(candidates, 'original', 'branch')?.id).toBe('branch');
    expect(getDefaultRightCandidate(candidates, 'original', 'missing')?.id).toBe('winner');
    expect(
      getDefaultRightCandidate(
        candidates.map(candidate => ({ ...candidate, isWinner: false })),
        'original'
      )?.id
    ).toBe('winner');
    const originalOnly = [
      { id: 'first', label: 'First', isOriginal: true },
      { id: 'second', label: 'Second', isOriginal: true },
    ];
    expect(getDefaultRightCandidate(originalOnly, 'first', 'missing')?.id).toBe('second');
    expect(getDefaultRightCandidate(originalOnly.slice(0, 1), null, 'missing')).toBeNull();
  });
});
