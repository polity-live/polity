/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useImportToolbarButtonController } from '../useImportToolbarButtonController';

const mocks = vi.hoisted(() => ({
  configs: [] as {
    onFilesSuccessfullySelected: (value: { plainFiles: File[] }) => Promise<void>;
  }[],
  deserializeHtml: vi.fn(() => ['html-node']),
  deserializeMarkdown: vi.fn(() => ['markdown-node']),
  insertNodes: vi.fn(),
}));
vi.mock('@platejs/markdown', () => ({ MarkdownPlugin: Symbol('markdown') }));
vi.mock('platejs/static', () => ({ getEditorDOMFromHtmlString: (text: string) => ({ text }) }));
vi.mock('platejs/react', () => ({
  useEditorRef: () => ({
    api: { html: { deserialize: mocks.deserializeHtml } },
    getApi: () => ({ markdown: { deserialize: mocks.deserializeMarkdown } }),
    tf: { insertNodes: mocks.insertNodes },
  }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('use-file-picker', () => ({
  useFilePicker: (config: (typeof mocks.configs)[number]) => {
    const index = mocks.configs.push(config);
    return { openFilePicker: vi.fn(() => index) };
  },
}));

describe('useImportToolbarButtonController', () => {
  it('imports markdown and HTML files and controls its menu', async () => {
    mocks.configs.length = 0;
    const { result } = renderHook(() => useImportToolbarButtonController());
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
    expect(result.current.labels.import).toBe('plateJs.toolbar.import');

    const file = { text: vi.fn(async () => 'content') } as unknown as File;
    await act(() => mocks.configs[0].onFilesSuccessfullySelected({ plainFiles: [file] }));
    expect(mocks.deserializeMarkdown).toHaveBeenCalledWith('content');
    expect(mocks.insertNodes).toHaveBeenCalledWith(['markdown-node']);
    await act(() => mocks.configs[1].onFilesSuccessfullySelected({ plainFiles: [file] }));
    expect(mocks.deserializeHtml).toHaveBeenCalled();
    expect(mocks.insertNodes).toHaveBeenCalledWith(['html-node']);
    result.current.onOpenMarkdownFilePicker();
    result.current.onOpenHtmlFilePicker();
  });
});
