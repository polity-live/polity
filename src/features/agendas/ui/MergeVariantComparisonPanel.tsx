'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { useMemo } from 'react';
import { computeDiff } from '@platejs/diff';
import { createSlateEditor, type Descendant, type Value } from 'platejs';
import { GitCompare, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { EditorStatic } from '@/features/shared/ui/ui-platejs/editor-static';
import { BaseEditorKit } from '@/features/shared/ui/kit-platejs/editor-base-kit';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface MergeVariantCandidate {
  id: string;
  label: string;
  groupName?: string | null;
  content?: unknown;
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

function getSuggestionProps(suggestionId: string, type: 'insert' | 'remove' | 'update') {
  return {
    suggestion: true,
    [`suggestion_${suggestionId}`]: {
      id: suggestionId,
      createdAt: Date.now(),
      type,
      userId: 'system',
    },
  };
}

function getUpdateSuggestionProps(
  suggestionId: string,
  properties: unknown,
  newProperties: unknown
) {
  const suggestionProps = getSuggestionProps(suggestionId, 'update');
  const suggestionMark = suggestionProps[`suggestion_${suggestionId}`] as Record<string, unknown>;

  return {
    ...suggestionProps,
    [`suggestion_${suggestionId}`]: {
      ...suggestionMark,
      properties,
      newProperties,
    },
  };
}

function buildDiffValue(
  baseContent: unknown,
  candidateContent: unknown,
  suggestionId: string
): Value {
  const baseValue = normalizePlateValue(baseContent);
  const candidateValue = normalizePlateValue(candidateContent);

  return computeDiff(baseValue as Descendant[], candidateValue as Descendant[], {
    isInline: () => false,
    getDeleteProps: () => getSuggestionProps(suggestionId, 'remove'),
    getInsertProps: () => getSuggestionProps(suggestionId, 'insert'),
    getUpdateProps: (_node, properties, newProperties) =>
      getUpdateSuggestionProps(suggestionId, properties, newProperties),
  }) as Value;
}

function VariantPreview({
  baseContent,
  candidate,
  isBase,
}: {
  baseContent: unknown;
  candidate: MergeVariantCandidate;
  isBase: boolean;
}) {
  const editor = useMemo(() => {
    const value = isBase
      ? normalizePlateValue(candidate.content)
      : buildDiffValue(baseContent, candidate.content, `merge_variant_${candidate.id}`);

    return createSlateEditor({
      plugins: BaseEditorKit,
      value,
    });
  }, [baseContent, candidate.content, candidate.id, isBase]);

  return (
    <div className="rounded-md border p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BadgeControl variant={isBase ? 'default' : 'outline'}>{candidate.label}</BadgeControl>
        {candidate.groupName ? (
          <BadgeControl variant="secondary" className="gap-1">
            <FileText className="h-3 w-3" />
            {candidate.groupName}
          </BadgeControl>
        ) : null}
        {isBase ? (
          <span className="text-muted-foreground text-xs">
            {translateText('generated.inline.0058_vergleichsbasis_e937c349')}
          </span>
        ) : null}
      </div>
      <div className="bg-muted/20 max-h-72 overflow-auto rounded-md border p-3">
        <EditorStatic editor={editor} variant="none" />
      </div>
    </div>
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

  if (!baseCandidate || orderedCandidates.length < 2) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5" />
          <CardTitle className="text-base">
            {translateText('generated.inline.0059_variantenvergleich_eaeb6685')}
          </CardTitle>
          <BadgeControl variant="outline" className="ml-auto">
            {translateText('generated.inline.0060_relative_wahl_5e35f421')}
          </BadgeControl>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {orderedCandidates.map((candidate, index) => (
          <VariantPreview
            key={candidate.id}
            baseContent={baseCandidate.content}
            candidate={candidate}
            isBase={index === 0}
          />
        ))}
      </CardContent>
    </Card>
  );
}
