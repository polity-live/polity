import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  Plate,
  PlateContent,
  PlateElement,
  ParagraphPlugin,
  usePlateEditor,
  type PlateElementProps,
} from 'platejs/react';
import { BasicMarksKit } from '@/features/shared/ui/kit-platejs/basic-marks-kit';
import { FontKit } from '@/features/shared/ui/kit-platejs/font-kit';
import {
  plateElementSchema,
  type RichTextNode,
  type StudioPlateElement,
} from '../logic/document-v3';
import { stableJson } from '../logic/operations';
import type { StudioTextSelectionEditor } from './StudioTextEditor';

function Paragraph(props: PlateElementProps) {
  const paragraph = props.element;
  return (
    <PlateElement
      {...props}
      style={{
        margin: 0,
        padding: 0,
        textAlign: paragraph.align as 'left' | undefined,
        display: paragraph.list ? 'list-item' : undefined,
        listStyleType: paragraph.list === 'number' ? 'decimal' : 'disc',
        marginLeft: paragraph.list ? '1.2em' : undefined,
        textDecoration: paragraph.url ? 'underline' : undefined,
      }}
    >
      {props.children}
    </PlateElement>
  );
}

export function normalizeStudioTextContent(value: unknown[]): StudioPlateElement[] {
  const normalize = (raw: unknown): unknown => {
    const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const id = typeof item.id === 'string' ? item.id : crypto.randomUUID();
    if (typeof item.text === 'string') {
      const keys = [
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'code',
        'highlight',
        'color',
        'backgroundColor',
        'fontSize',
        'fontFamily',
        'textStyleId',
        'colorBinding',
        'data',
      ];
      return Object.fromEntries([
        ['id', id],
        ['text', item.text],
        ...keys.filter(key => item[key] !== undefined).map(key => [key, item[key]]),
      ]);
    }
    const keys = ['align', 'list', 'url', 'checked', 'indent', 'language', 'value', 'data'];
    return Object.fromEntries([
      ['id', id],
      ['type', typeof item.type === 'string' ? item.type : 'p'],
      [
        'children',
        Array.isArray(item.children) && item.children.length
          ? item.children.map(normalize)
          : [{ id: crypto.randomUUID(), text: '' }],
      ],
      ...keys.filter(key => item[key] !== undefined).map(key => [key, item[key]]),
    ]);
  };
  return value.map(item => plateElementSchema.parse(normalize(item)));
}

export function StudioInlineTextEditor({
  node,
  onChange,
  register,
}: {
  node: RichTextNode;
  onChange: (content: StudioPlateElement[]) => void;
  register: (editor: StudioTextSelectionEditor | null) => void;
}) {
  const t = useTranslation().t;
  const editor = usePlateEditor(
    {
      plugins: [ParagraphPlugin.withComponent(Paragraph), ...BasicMarksKit, ...FontKit],
      value: node.content as never,
    },
    [node.id]
  );
  const published = useRef(stableJson(node.content));
  useLayoutEffect(() => {
    editor.tf.focus({ edge: 'endEditor' });
  }, [editor, node.id]);
  useEffect(() => {
    const incoming = stableJson(node.content);
    if (incoming !== published.current) {
      published.current = incoming;
      editor.tf.setValue(node.content as never);
    }
  }, [editor, node.content]);
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
        if (key === 'url') {
          editor.tf.setNodes({ url: value });
          return;
        }
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
  }, [editor, register]);
  return (
    <Plate
      editor={editor}
      onValueChange={({ value }) => {
        const content = normalizeStudioTextContent(value);
        published.current = stableJson(content);
        onChange(content);
      }}
    >
      <PlateContent
        aria-label={t('features.studio.editText')}
        style={{
          width: '100%',
          minHeight: node.transform.height,
          fontFamily: node.typography.fontFamily,
          fontSize: node.typography.fontSize,
          lineHeight: node.typography.lineHeight,
          letterSpacing: node.typography.letterSpacing,
          textAlign: node.typography.horizontalAlign,
          color: node.style.fill ?? '#12362D',
          outline: '1px solid #6856c8',
          background: 'transparent',
          whiteSpace: 'pre-wrap',
        }}
        renderLeaf={({ attributes, children, leaf }) => (
          <span
            {...attributes}
            style={{
              fontWeight: leaf.bold ? 'bold' : undefined,
              fontStyle: leaf.italic ? 'italic' : undefined,
              textDecoration: [
                leaf.underline ? 'underline' : '',
                leaf.strikethrough ? 'line-through' : '',
              ].join(' '),
              fontFamily: leaf.fontFamily as string | undefined,
              fontSize: leaf.fontSize as number | undefined,
              color: leaf.color as string | undefined,
              backgroundColor:
                (leaf.backgroundColor as string | undefined) ??
                (leaf.highlight ? '#FFF0A8' : undefined),
            }}
          >
            {children}
          </span>
        )}
      />
    </Plate>
  );
}
