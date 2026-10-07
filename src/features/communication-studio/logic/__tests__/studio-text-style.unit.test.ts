import { createSlateEditor, type Value } from 'platejs';
import { expect, it, vi } from 'vitest';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { studioDocumentV3Schema } from '../document-v3';
import { semanticElement } from '../v3-adapter';
import { activePalette, applyTextStyleToNode, paletteColor, themeFontFamily } from '../theme';
import { applyStudioSelectionTextStyle } from '../studio-text-style';

function fixture() {
  const document = studioDocumentV3Schema.parse(
    createStudioTemplateDocumentV5('single', 'Text styles', defaultBrand)
  );
  const node = document.nodes.find(node => node.type === 'richText')!;
  const active = semanticElement(node)!;
  const theme = document.theme;
  const style = theme.textStyles[0];
  const palette = activePalette(theme);
  const slate = createSlateEditor({ value: structuredClone(node.content) as unknown as Value });
  const text = slate.children[0].children[0] as { text: string };
  slate.tf.select({
    anchor: { path: [0, 0], offset: 0 },
    focus: { path: [0, 0], offset: text.text.length },
  });
  const editor = {
    mark: (key: string, value: unknown) => slate.tf.addMark(key, value),
    setMark: (key: string, value: unknown) => slate.tf.addMark(key, value),
    paragraph: (key: string, value: unknown) => slate.tf.setNodes({ [key]: value }),
  };
  const applyToSelection = vi.fn((id: string) => {
    const selectedStyle = theme.textStyles.find(candidate => candidate.id === id)!;
    applyTextStyleToNode(node, selectedStyle, palette);
  });
  const options = { styleId: style.id, theme, palette, editor, active, applyToSelection };
  return { options, document, node, style, slate };
}
it.each(['missing theme', 'unknown style', 'missing palette'] as const)(
  'leaves the actual editor and selection unchanged for %s',
  kind => {
    const { options, slate, document } = fixture();
    const before = structuredClone(slate.children);
    const canonical = structuredClone(document);
    applyStudioSelectionTextStyle({
      ...options,
      theme: kind === 'missing theme' ? undefined : options.theme,
      styleId: kind === 'unknown style' ? crypto.randomUUID() : options.styleId,
      palette: kind === 'missing palette' ? null : options.palette,
    });
    expect(slate.children).toEqual(before);
    expect(document).toEqual(canonical);
    expect(options.applyToSelection).not.toHaveBeenCalled();
  }
);
it('applies all theme marks and alignment to the actual Slate selection without mutating the canonical node', () => {
  const { options, style, slate, node } = fixture();
  const before = structuredClone(node);
  applyStudioSelectionTextStyle(options);
  const block = slate.children[0];
  expect(block.align).toBe(style.align);
  expect(block.children[0]).toMatchObject({
    textStyleId: style.id,
    fontFamily: themeFontFamily(style.font),
    fontSize: style.size,
    colorBinding: style.color,
    color: paletteColor(options.palette, style.color),
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
  });
  expect(node).toEqual(before);
  expect(options.applyToSelection).not.toHaveBeenCalled();
});
it.each(['no inline editor', 'no active node', 'active shape'] as const)(
  'applies to the canonical selection when there is %s',
  kind => {
    const { options, document, node, style, slate } = fixture();
    const before = structuredClone(slate.children);
    const shape = document.nodes.find(candidate => candidate.type === 'shape')!;
    applyStudioSelectionTextStyle({
      ...options,
      editor: kind === 'no inline editor' ? null : options.editor,
      active:
        kind === 'no active node'
          ? undefined
          : kind === 'active shape'
            ? semanticElement(shape)!
            : options.active,
    });
    expect(options.applyToSelection).toHaveBeenCalledWith(style.id);
    expect(node.typography.textStyleId).toBe(style.id);
    expect(node.style.fill).toBe(paletteColor(options.palette, style.color));
    expect(slate.children).toEqual(before);
    expect(studioDocumentV3Schema.safeParse(document).success).toBe(true);
  }
);
