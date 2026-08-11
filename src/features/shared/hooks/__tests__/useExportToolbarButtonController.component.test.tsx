/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  canvas: {
    height: 50,
    toDataURL: vi.fn((format?: string) => `data:${format ?? 'image'}`),
    width: 100,
  } as any,
  cloneEditorElement: undefined as any,
  createSlateEditor: vi.fn((options: any) => ({ ...options, static: true })),
  editorDom: document.createElement('div') as HTMLElement | null,
  exportToDocx: vi.fn(async () => new Blob(['docx'])),
  html2canvas: vi.fn(),
  markdownSerialize: vi.fn(() => '# heading'),
  pdfCreate: vi.fn(),
  serializeHtml: vi.fn(async () => '<p>HTML</p>'),
}));

vi.mock('@platejs/markdown', () => ({ MarkdownPlugin: { key: 'markdown' } }));
vi.mock('@/features/shared/ui/kit-platejs/editor-base-kit.tsx', () => ({
  BaseEditorKit: [{ key: 'base' }],
}));
vi.mock('@/features/shared/ui/ui-platejs/editor-static.tsx', () => ({
  EditorStatic: () => null,
}));
vi.mock('platejs', () => ({ createSlateEditor: mocks.createSlateEditor }));
vi.mock('platejs/static', () => ({ serializeHtml: mocks.serializeHtml }));
vi.mock('platejs/react', () => ({
  useEditorRef: () => ({
    api: { toDOMNode: () => mocks.editorDom },
    children: [{ text: 'Editor' }],
    getApi: () => ({ markdown: { serialize: mocks.markdownSerialize } }),
  }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('html2canvas-pro', () => ({ default: mocks.html2canvas }));
vi.mock('@platejs/docx-io', () => ({
  DocxExportPlugin: { key: 'docx' },
  exportToDocx: mocks.exportToDocx,
}));
vi.mock('pdf-lib', () => ({
  PDFDocument: { create: mocks.pdfCreate },
}));

import { useExportToolbarButtonController } from '../useExportToolbarButtonController';

describe('useExportToolbarButtonController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editorDom = document.createElement('div');
    mocks.cloneEditorElement = undefined;
    mocks.html2canvas.mockImplementation(async (_element: HTMLElement, options: any) => {
      options.onclone({
        querySelector: () => mocks.cloneEditorElement,
      });
      return mocks.canvas;
    });
    mocks.pdfCreate.mockResolvedValue({
      addPage: () => ({ drawImage: vi.fn() }),
      embedPng: async () => ({ scale: () => ({ height: 50, width: 100 }) }),
      saveAsBase64: async () => 'data:pdf',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob(['file']) }))
    );
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:file'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('exports HTML, Markdown, Word, image, and PDF and exposes translated labels', async () => {
    const view = renderHook(() => useExportToolbarButtonController());
    expect(view.result.current.labels.export).toBe('plateJs.toolbar.export');
    act(() => view.result.current.setOpen(true));
    expect(view.result.current.open).toBe(true);

    await act(() => view.result.current.exportToHtml());
    expect(mocks.serializeHtml).toHaveBeenCalled();
    await act(() => view.result.current.exportToMarkdown());
    expect(mocks.markdownSerialize).toHaveBeenCalled();
    await act(() => view.result.current.exportToWord());
    expect(mocks.exportToDocx).toHaveBeenCalled();

    await act(() => view.result.current.exportToImage());
    await act(() => view.result.current.exportToPdf());
    expect(mocks.canvas.toDataURL).toHaveBeenCalledWith('image/png');
    expect(mocks.canvas.toDataURL).toHaveBeenCalledWith('PNG');
    expect(fetch).toHaveBeenCalledWith('data:pdf');
  });

  it('styles cloned editor descendants with and without existing styles', async () => {
    const plain = document.createElement('span');
    const styled = document.createElement('strong');
    styled.setAttribute('style', 'color: red');
    mocks.cloneEditorElement = {
      querySelectorAll: () => [plain, styled],
    };
    const view = renderHook(() => useExportToolbarButtonController());
    await act(() => view.result.current.exportToImage());
    expect(plain.getAttribute('style')).toContain('font-family');
    expect(styled.getAttribute('style')).toContain('color: red; font-family');
  });

  it('aborts both canvas exports when the editor has no DOM node', async () => {
    mocks.editorDom = null;
    const view = renderHook(() => useExportToolbarButtonController());
    await act(() => view.result.current.exportToImage());
    await act(() => view.result.current.exportToPdf());
    expect(mocks.html2canvas).not.toHaveBeenCalled();
  });
});
