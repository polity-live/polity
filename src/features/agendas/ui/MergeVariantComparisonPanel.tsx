'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { useCallback, useMemo, useState } from 'react';
import { createSlateEditor, type Value } from 'platejs';
import { ArrowRight, GitCompare, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { EditorStatic } from '@/features/shared/ui/ui-platejs/editor-static';
import { BaseEditorKit } from '@/features/shared/ui/kit-platejs/editor-base-kit';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';

export interface MergeVariantCandidate {
  id: string;
  label: string;
  groupName?: string | null;
  content?: unknown;
}

interface LineDiffRow {
  kind: 'context' | 'remove' | 'add';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  text: string;
}

function emptyValue(): Value {
  return [{ type: 'p', children: [{ text: '' }] }] as Value;
}

function normalizePlateValue(content: unknown): Value {
  if (Array.isArray(content)) {
    return content as Value;
  }

  if (
    content &&
    typeof content === 'object' &&
    Array.isArray((content as { content?: unknown }).content)
  ) {
    return (content as { content: Value }).content;
  }

  return emptyValue();
}

function extractTextFromNode(node: unknown): string {
  if (!node || typeof node !== 'object') return '';

  const maybeText = (node as { text?: unknown }).text;
  if (typeof maybeText === 'string') return maybeText;

  const children = (node as { children?: unknown }).children;
  if (!Array.isArray(children)) return '';

  return children.map(extractTextFromNode).join('');
}

function extractPlainTextLines(content: unknown): string[] {
  const value = normalizePlateValue(content);
  const lines = value.flatMap(node => extractTextFromNode(node).split(/\r?\n/));

  return lines.length > 0 ? lines : [''];
}

function buildUnifiedLineDiff(leftLines: string[], rightLines: string[]): LineDiffRow[] {
  const rowCount = leftLines.length + 1;
  const columnCount = rightLines.length + 1;
  const lcs = Array.from({ length: rowCount }, () => Array<number>(columnCount).fill(0));

  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
      lcs[leftIndex][rightIndex] =
        leftLines[leftIndex] === rightLines[rightIndex]
          ? lcs[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(lcs[leftIndex + 1][rightIndex], lcs[leftIndex][rightIndex + 1]);
    }
  }

  const rows: LineDiffRow[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  let oldLineNumber = 1;
  let newLineNumber = 1;

  while (leftIndex < leftLines.length || rightIndex < rightLines.length) {
    if (
      leftIndex < leftLines.length &&
      rightIndex < rightLines.length &&
      leftLines[leftIndex] === rightLines[rightIndex]
    ) {
      rows.push({
        kind: 'context',
        oldLineNumber,
        newLineNumber,
        text: leftLines[leftIndex],
      });
      leftIndex += 1;
      rightIndex += 1;
      oldLineNumber += 1;
      newLineNumber += 1;
      continue;
    }

    if (
      leftIndex < leftLines.length &&
      (rightIndex >= rightLines.length ||
        lcs[leftIndex + 1][rightIndex] >= lcs[leftIndex][rightIndex + 1])
    ) {
      rows.push({
        kind: 'remove',
        oldLineNumber,
        newLineNumber: null,
        text: leftLines[leftIndex],
      });
      leftIndex += 1;
      oldLineNumber += 1;
      continue;
    }

    if (rightIndex < rightLines.length) {
      rows.push({
        kind: 'add',
        oldLineNumber: null,
        newLineNumber,
        text: rightLines[rightIndex],
      });
      rightIndex += 1;
      newLineNumber += 1;
    }
  }

  return rows;
}

function getFirstOtherCandidate(
  candidates: MergeVariantCandidate[],
  candidateId: string
): MergeVariantCandidate | null {
  return candidates.find(candidate => candidate.id !== candidateId) ?? null;
}

function VariantPreview({
  candidate,
  descriptor,
  testId,
}: {
  candidate: MergeVariantCandidate;
  descriptor?: string;
  testId?: string;
}) {
  const editor = useMemo(() => {
    const value = normalizePlateValue(candidate.content);

    return createSlateEditor({
      plugins: BaseEditorKit,
      value,
    });
  }, [candidate.content]);

  return (
    <div className="rounded-md border p-3" data-testid={testId ?? 'merge-variant-preview'}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BadgeControl variant={descriptor ? 'default' : 'outline'}>{candidate.label}</BadgeControl>
        {candidate.groupName ? (
          <BadgeControl variant="secondary" className="gap-1">
            <FileText className="h-3 w-3" />
            {candidate.groupName}
          </BadgeControl>
        ) : null}
        {descriptor ? <span className="text-muted-foreground text-xs">{descriptor}</span> : null}
      </div>
      <div className="bg-muted/20 max-h-72 overflow-auto rounded-md border p-3">
        <EditorStatic editor={editor} variant="none" />
      </div>
    </div>
  );
}

function VariantPicker({
  candidates,
  leftCandidate,
  rightCandidate,
  onLeftCandidateChange,
  onRightCandidateChange,
}: {
  candidates: MergeVariantCandidate[];
  leftCandidate: MergeVariantCandidate;
  rightCandidate: MergeVariantCandidate;
  onLeftCandidateChange: (value: string) => void;
  onRightCandidateChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
      <CandidateSelect
        label={translateText('generated.inline.0063_ausgangsvariante_258f7e56', 'Ausgangsvariante')}
        value={leftCandidate.id}
        candidates={candidates}
        testId="merge-variant-left-select"
        onValueChange={onLeftCandidateChange}
      />
      <ArrowRight className="text-muted-foreground hidden h-4 w-4 lg:block" />
      <CandidateSelect
        label={translateText(
          'generated.inline.0064_vergleichsvariante_553b54a9',
          'Vergleichsvariante'
        )}
        value={rightCandidate.id}
        candidates={candidates}
        testId="merge-variant-right-select"
        onValueChange={onRightCandidateChange}
      />
    </div>
  );
}

function LineDiffView({
  leftCandidate,
  rightCandidate,
}: {
  leftCandidate: MergeVariantCandidate;
  rightCandidate: MergeVariantCandidate;
}) {
  const rows = useMemo(
    () =>
      buildUnifiedLineDiff(
        extractPlainTextLines(leftCandidate.content),
        extractPlainTextLines(rightCandidate.content)
      ),
    [leftCandidate.content, rightCandidate.content]
  );
  const hasChanges = rows.some(row => row.kind !== 'context');

  return (
    <div
      className="bg-muted/20 overflow-hidden rounded-md border"
      data-testid="merge-variant-line-diff"
    >
      <div className="bg-muted/40 text-muted-foreground grid grid-cols-[4rem_4rem_2rem_minmax(0,1fr)] border-b px-3 py-2 font-mono text-xs">
        <span>{translateText('generated.inline.0066_alt_f2cd1711', 'alt')}</span>
        <span>{translateText('generated.inline.0067_neu_25cfb35f', 'neu')}</span>
        <span />
        <span>
          {leftCandidate.label}
          {' -> '}
          {rightCandidate.label}
        </span>
      </div>

      {!hasChanges ? (
        <div
          className="text-muted-foreground px-3 py-4 text-sm"
          data-testid="merge-variant-no-diff"
        >
          {translateText('generated.inline.0068_keine_unterschiede_60b6557a', 'Keine Unterschiede')}
        </div>
      ) : (
        <div className="max-h-96 overflow-auto">
          {rows.map((row, index) => (
            <div
              key={`${row.kind}-${index}-${row.oldLineNumber ?? 'x'}-${row.newLineNumber ?? 'x'}`}
              className={
                row.kind === 'remove'
                  ? 'grid grid-cols-[4rem_4rem_2rem_minmax(0,1fr)] bg-red-50 px-3 py-1 font-mono text-xs text-red-950 dark:bg-red-950/30 dark:text-red-100'
                  : row.kind === 'add'
                    ? 'grid grid-cols-[4rem_4rem_2rem_minmax(0,1fr)] bg-emerald-50 px-3 py-1 font-mono text-xs text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100'
                    : 'grid grid-cols-[4rem_4rem_2rem_minmax(0,1fr)] px-3 py-1 font-mono text-xs'
              }
              data-testid={`merge-variant-diff-row-${row.kind}`}
            >
              <span className="text-muted-foreground select-none">{row.oldLineNumber ?? ''}</span>
              <span className="text-muted-foreground select-none">{row.newLineNumber ?? ''}</span>
              <span className="select-none">
                {row.kind === 'remove' ? '-' : row.kind === 'add' ? '+' : ' '}
              </span>
              <span className="break-words whitespace-pre-wrap">{row.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateSelect({
  label,
  value,
  candidates,
  testId,
  onValueChange,
}: {
  label: string;
  value: string;
  candidates: MergeVariantCandidate[];
  testId: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 flex-1 space-y-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger data-testid={testId} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {candidates.map(candidate => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function MergeVariantComparisonPanel({
  candidates,
}: {
  candidates: MergeVariantCandidate[];
}) {
  const orderedCandidates = useMemo(
    () => candidates.filter(candidate => candidate.content),
    [candidates]
  );
  const baseCandidate = orderedCandidates[0] ?? null;
  const [leftCandidateId, setLeftCandidateId] = useState<string | null>(null);
  const [rightCandidateId, setRightCandidateId] = useState<string | null>(null);

  const leftCandidate =
    orderedCandidates.find(candidate => candidate.id === leftCandidateId) ??
    orderedCandidates[0] ??
    null;
  const rightCandidate =
    orderedCandidates.find(
      candidate => candidate.id === rightCandidateId && candidate.id !== leftCandidate?.id
    ) ?? (leftCandidate ? getFirstOtherCandidate(orderedCandidates, leftCandidate.id) : null);

  const handleLeftCandidateChange = useCallback(
    (nextCandidateId: string) => {
      setLeftCandidateId(nextCandidateId);
      if (rightCandidate?.id === nextCandidateId) {
        setRightCandidateId(getFirstOtherCandidate(orderedCandidates, nextCandidateId)?.id ?? null);
      }
    },
    [orderedCandidates, rightCandidate?.id]
  );

  const handleRightCandidateChange = useCallback(
    (nextCandidateId: string) => {
      setRightCandidateId(nextCandidateId);
      if (leftCandidate?.id === nextCandidateId) {
        setLeftCandidateId(getFirstOtherCandidate(orderedCandidates, nextCandidateId)?.id ?? null);
      }
    },
    [leftCandidate?.id, orderedCandidates]
  );

  if (!baseCandidate || orderedCandidates.length < 2) {
    return null;
  }

  if (!leftCandidate || !rightCandidate) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5" />
          <CardTitle className="text-base">
            {translateText(
              'generated.inline.0059_variantenvergleich_eaeb6685',
              'Variantenvergleich'
            )}
          </CardTitle>
          <BadgeControl variant="outline" className="ml-auto">
            {translateText('generated.inline.0060_relative_wahl_5e35f421', 'relative Wahl')}
          </BadgeControl>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="variants" className="space-y-3">
          <TabsList>
            <TabsTrigger value="variants">
              {translateText('generated.inline.0061_varianten_cab97314', 'Varianten')}
            </TabsTrigger>
            <TabsTrigger value="diff">
              {translateText('generated.inline.0062_diff_066987c3', 'Diff')}
            </TabsTrigger>
          </TabsList>

          <VariantPicker
            candidates={orderedCandidates}
            leftCandidate={leftCandidate}
            rightCandidate={rightCandidate}
            onLeftCandidateChange={handleLeftCandidateChange}
            onRightCandidateChange={handleRightCandidateChange}
          />

          <TabsContent value="variants">
            <div className="grid gap-3 lg:grid-cols-2" data-testid="merge-variant-grid">
              <VariantPreview
                candidate={leftCandidate}
                descriptor={translateText(
                  'generated.inline.0063_ausgangsvariante_258f7e56',
                  'Ausgangsvariante'
                )}
                testId="merge-variant-left-preview"
              />
              <VariantPreview
                candidate={rightCandidate}
                descriptor={translateText(
                  'generated.inline.0064_vergleichsvariante_553b54a9',
                  'Vergleichsvariante'
                )}
                testId="merge-variant-right-preview"
              />
            </div>
          </TabsContent>

          <TabsContent value="diff">
            <LineDiffView leftCandidate={leftCandidate} rightCandidate={rightCandidate} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
