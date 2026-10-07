import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useEffect, useRef } from 'react';
import {
  Plate,
  PlateContent,
  usePlateEditor,
  ParagraphPlugin,
  PlateElement,
  type PlateElementProps,
} from 'platejs/react';
import { BasicMarksKit } from '@/features/shared/ui/kit-platejs/basic-marks-kit';
import { FontKit } from '@/features/shared/ui/kit-platejs/font-kit';
import { stableJson } from '../logic/operations';
import type { StudioElement } from '../logic/document';
function StudioParagraph(props: PlateElementProps) {
  const e = props.element;
  return (
    <PlateElement
      {...props}
      style={{
        margin: 0,
        padding: 0,
        textAlign: e.align as 'left',
        display: e.list ? 'list-item' : undefined,
        listStyleType: e.list === 'number' ? 'decimal' : 'disc',
        marginLeft: e.list ? '1.2em' : undefined,
      }}
    >
      {props.children}
    </PlateElement>
  );
}
export interface StudioTextSelectionEditor {
  mark: (key: string, value: unknown) => void;
  setMark: (key: string, value: unknown) => void;
  paragraph: (key: string, value: unknown) => void;
}
/** Slate paste and split operations can introduce missing or duplicate paragraph identities. */
export function normalizeStudioLegacyParagraphs(
  value: readonly { id?: unknown; children: unknown[]; [key: string]: unknown }[],
  repairIdentity: (id: string, index: number) => void
) {
  const seen = new Set<string>();
  return value.map((node, index) => {
    let id = typeof node.id === 'string' ? node.id : '';
    if (!id || seen.has(id)) {
      id = crypto.randomUUID();
      repairIdentity(id, index);
    }
    seen.add(id);
    return {
      ...node,
      id,
      type: 'p' as const,
      children: node.children as StudioElement['richText'][number]['children'],
    };
  });
}
export function StudioTextEditor({
  element,
  onChange,
  register,
}: {
  element: StudioElement;
  onChange: (patch: Partial<StudioElement>) => void;
  register: (editor: StudioTextSelectionEditor | null) => void;
}) {
  const { t } = useTranslation();
  const editor = usePlateEditor(
    {
      plugins: [ParagraphPlugin.withComponent(StudioParagraph), ...BasicMarksKit, ...FontKit],
      value: element.richText.length
        ? element.richText
        : element.text
            .split('\n')
            .map(text => ({ id: crypto.randomUUID(), type: 'p', children: [{ text }] })),
    },
    [element.id]
  );
  const published = useRef(stableJson({ text: element.text, richText: element.richText }));
  useEffect(() => {
    const incoming = stableJson({ text: element.text, richText: element.richText });
    if (incoming !== published.current) {
      published.current = incoming;
      editor.tf.setValue(
        element.richText.length
          ? element.richText
          : element.text
              .split('\n')
              .map(text => ({ id: crypto.randomUUID(), type: 'p', children: [{ text }] }))
      );
    }
  }, [element.text, element.richText, editor]);
  useEffect(() => {
    const syncSelection = () => {
      const selection = window.getSelection();
      if (selection?.anchorNode?.parentElement?.closest('[data-slate-editor="true"]')) {
        const range = editor.api.toSlateRange(selection, {
          exactMatch: false,
          suppressThrow: true,
        });
        if (range) editor.tf.select(range);
      }
    };
    register({
      mark: (key, value) => {
        syncSelection();
        if (typeof value === 'boolean') value = !editor.api.marks()?.[key];
        if (value === null) editor.tf.removeMark(key);
        else editor.tf.addMark(key, value);
      },
      setMark: (key, value) => {
        syncSelection();
        if (value === null) editor.tf.removeMark(key);
        else editor.tf.addMark(key, value);
      },
      paragraph: (key, value) => {
        syncSelection();
        editor.tf.setNodes({ [key]: value });
      },
    });
    return () => register(null);
  }, [editor]);
  return (
    <Plate
      editor={editor}
      onValueChange={({ value }) => {
        const richText = normalizeStudioLegacyParagraphs(value, (id, index) => {
          queueMicrotask(() => editor.tf.setNodes({ id }, { at: [index] }));
        });
        const patch = {
          richText,
          text: richText.map(p => p.children.map(r => r.text).join('')).join('\n'),
        };
        published.current = stableJson(patch);
        onChange(patch);
      }}
    >
      <PlateContent
        autoFocus
        aria-label={t('features.studio.editText')}
        style={{
          fontFamily: element.font,
          fontSize: element.fontSize,
          color: element.fill,
          lineHeight: element.lineHeight,
          textAlign: element.align,
          fontWeight: element.bold ? 'bold' : undefined,
          fontStyle: element.italic ? 'italic' : undefined,
          minHeight: element.height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent:
            element.verticalAlign === 'middle'
              ? 'center'
              : element.verticalAlign === 'bottom'
                ? 'flex-end'
                : 'flex-start',
          outline: '2px solid var(--primary)',
        }}
        renderLeaf={({ attributes, children, leaf }) => (
          <span
            {...attributes}
            style={{
              fontWeight: leaf.bold === undefined ? undefined : leaf.bold ? 'bold' : 'normal',
              fontStyle: leaf.italic === undefined ? undefined : leaf.italic ? 'italic' : 'normal',
              textDecoration: [
                leaf.underline ? 'underline' : '',
                leaf.strikethrough ? 'line-through' : '',
              ].join(' '),
              color: leaf.color as string,
              fontSize: leaf.fontSize as number,
              fontFamily: leaf.fontFamily as string,
            }}
          >
            {children}
          </span>
        )}
      />
    </Plate>
  );
}
