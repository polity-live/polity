import { DocxExportPlugin, exportToDocx, importDocx } from '@platejs/docx-io';
import { createSlateEditor, type SlatePlugin } from 'platejs';
import { expect, it } from 'vitest';

import { BaseEditorKit } from '@/features/shared/ui/kit-platejs/editor-base-kit';

it('preserves text, bold formatting, and table cells through a real DOCX export and import', async () => {
  const value = [
    { type: 'p', children: [{ text: 'Polity DOCX ', bold: true }, { text: 'round trip' }] },
    {
      type: 'table',
      children: [
        {
          type: 'tr',
          children: [
            { type: 'td', children: [{ type: 'p', children: [{ text: 'Proposal' }] }] },
            { type: 'td', children: [{ type: 'p', children: [{ text: 'Approved' }] }] },
          ],
        },
      ],
    },
  ];
  const blob = await exportToDocx(value, {
    editorPlugins: [...BaseEditorKit, DocxExportPlugin] as SlatePlugin[],
  });
  const bytes = await blob.arrayBuffer();
  expect([...new Uint8Array(bytes).slice(0, 2)]).toEqual([0x50, 0x4b]);

  const editor = createSlateEditor({ plugins: BaseEditorKit });
  const imported = await importDocx(editor, bytes);
  expect(imported.nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: 'p',
        children: expect.arrayContaining([
          expect.objectContaining({ text: 'Polity DOCX ', bold: true }),
          expect.objectContaining({ text: 'round trip' }),
        ]),
      }),
      expect.objectContaining({ type: 'table' }),
    ])
  );
  expect(JSON.stringify(imported.nodes)).toContain('Proposal');
  expect(JSON.stringify(imported.nodes)).toContain('Approved');
}, 30_000);
