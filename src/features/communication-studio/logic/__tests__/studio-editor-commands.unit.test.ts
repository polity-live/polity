import { expect, it, vi } from 'vitest';
import { defaultBrand, element } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { studioDocumentV3Schema } from '../document-v3';
import { createStudioNodeFromElement } from '../create-studio-node';
import { applyThemeSnapshot, createThemeSnapshot } from '../theme';
import { createTableData, type TableDimensions } from '../table-operations';
import { insertStudioEditorTable, selectStudioEditorTheme } from '../studio-editor-commands';

it.each(['existing dark mode', 'loading current theme', 'unknown theme'] as const)(
  'chooses a theme with %s',
  kind => {
    const document = createStudioTemplateDocumentV5('single', 'Theme choice', defaultBrand);
    const next = createThemeSnapshot();
    next.name = 'Selected theme';
    const before = structuredClone(document);
    const apply = vi.fn((theme: typeof next) => applyThemeSnapshot(document, theme));
    selectStudioEditorTheme({
      themes: [next],
      themeId: kind === 'unknown theme' ? crypto.randomUUID() : next.themeId,
      current: kind === 'loading current theme' ? undefined : { ...document.theme, mode: 'dark' },
      apply,
    });
    if (kind === 'unknown theme') {
      expect(document).toEqual(before);
      expect(apply).not.toHaveBeenCalled();
    } else {
      expect(document.theme.name).toBe('Selected theme');
      expect(document.theme.mode).toBe(kind === 'existing dark mode' ? 'dark' : 'light');
      expect(apply).toHaveBeenCalledOnce();
      expect(studioDocumentV3Schema.safeParse(document).success).toBe(true);
    }
  }
);
it.each(['ready frame', 'unavailable frame'] as const)(
  'acknowledges table insertion only for a %s',
  kind => {
    const document = createStudioTemplateDocumentV5('single', 'Table insertion', defaultBrand);
    if (kind === 'unavailable frame') {
      document.nodes = [];
      document.deliverables = [];
    }
    studioDocumentV3Schema.parse(document);
    const inserted = vi.fn();
    const dimensions = { rowCount: 2, colCount: 3 };
    const insert = (dimensions: TableDimensions) => {
      const frame = document.nodes.find(node => node.type === 'frame');
      if (!frame) return null;
      const node = createStudioNodeFromElement(
        element('table', { table: createTableData(dimensions) }),
        frame.id,
        document.nodes.length
      );
      document.nodes.push(node);
      return node.id;
    };
    insertStudioEditorTable({ dimensions, insert, inserted });
    expect(inserted).toHaveBeenCalledTimes(kind === 'ready frame' ? 1 : 0);
    expect(document.nodes.filter(node => node.type === 'table')).toHaveLength(
      kind === 'ready frame' ? 1 : 0
    );
    expect(studioDocumentV3Schema.safeParse(document).success).toBe(true);
  }
);
