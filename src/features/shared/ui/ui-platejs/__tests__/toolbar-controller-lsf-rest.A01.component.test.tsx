/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  childProps: [] as any[],
  filePickerOptions: undefined as any,
  insertBlock: vi.fn(),
  insertInline: vi.fn(),
  openData: vi.fn(),
  insertMedia: vi.fn(),
  setOpen: vi.fn(),
}));

function view(name: string) {
  return (props: any) => {
    mocks.childProps.push({ name, props });
    return <div data-testid={name} />;
  };
}
vi.mock('platejs', () => ({
  KEYS: {
    p: 'p',
    table: 'table',
    codeBlock: 'code',
    blockquote: 'quote',
    hr: 'hr',
    ul: 'ul',
    ol: 'ol',
    listTodo: 'todo',
    toggle: 'toggle',
    img: 'img',
    mediaEmbed: 'embed',
    toc: 'toc',
    equation: 'equation',
    link: 'link',
    date: 'date',
    inlineEquation: 'inline-equation',
    audio: 'audio',
    file: 'file',
    video: 'video',
  },
}));
vi.mock('platejs/react', () => ({
  PlateElement: () => null,
  useEditorRef: () => ({
    id: 'editor',
    getTransforms: () => ({ insert: { media: mocks.insertMedia } }),
  }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/ui/kit-platejs/transforms.ts', () => ({
  insertBlock: mocks.insertBlock,
  insertInlineElement: mocks.insertInline,
}));
vi.mock('@/features/charts/types', () => ({ DATA_VIEW_NODE_TYPE: 'data-view' }));
vi.mock('@/features/charts/ui/ChartDialog', () => ({ openDataViewDialog: mocks.openData }));
vi.mock('@platejs/media/react', () => ({
  PlaceholderPlugin: {},
  useImagePreviewValue: (key: string) => key,
  useImagePreview: () => ({
    closeProps: {},
    currentUrlIndex: 0,
    maskLayerProps: {},
    nextDisabled: false,
    nextProps: {},
    prevDisabled: false,
    prevProps: {},
    scaleTextProps: {},
    zommOutProps: {},
    zoomInDisabled: false,
    zoomInProps: {},
    zoomOutDisabled: false,
  }),
}));
vi.mock('use-file-picker', () => ({
  useFilePicker: (options: any) => {
    mocks.filePickerOptions = options;
    return { openFilePicker: vi.fn() };
  },
}));
vi.mock('../InsertToolbarButtonView', () => ({ InsertToolbarButtonView: view('insert-view') }));
vi.mock('../MediaToolbarButtonView', () => ({ MediaToolbarButtonView: view('media-view') }));
vi.mock('../MediaPreviewDialogView', () => ({ MediaPreviewDialogView: view('preview-view') }));
vi.mock('@platejs/callout/react', () => ({
  useCalloutEmojiPicker: () => ({ emojiToolbarDropdownProps: {}, props: { callout: true } }),
}));
vi.mock('@platejs/emoji/react', () => ({
  useEmojiDropdownMenuState: () => ({
    emojiPickerState: {},
    isOpen: false,
    setIsOpen: mocks.setOpen,
  }),
}));
vi.mock('@platejs/toc/react', () => ({
  useTocElementState: () => ({ headingList: ['h'] }),
  useTocElement: () => ({ props: { toc: true } }),
}));
vi.mock('@platejs/toggle/react', () => ({
  useToggleButtonState: (id: string) => ({ id }),
  useToggleButton: () => ({ buttonProps: {}, open: true }),
}));
vi.mock('@/features/shared/ui/layout', () => ({
  ToolbarButton: ({
    children,
    onClick,
    pressed: _pressed,
    isDropdown: _isDropdown,
    ...props
  }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

import { InsertToolbarButton } from '../insert-toolbar-button';
import { MediaToolbarButton } from '../media-toolbar-button';
import { MediaPreviewDialog } from '../media-preview-dialog';
import { LineHeightToolbarButtonView } from '../LineHeightToolbarButtonView';
import { useCalloutElementController } from '../useCalloutElementController';
import { useTocElementController } from '../useTocElementController';
import { useToggleElementController } from '../useToggleElementController';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.childProps = [];
  mocks.filePickerOptions = undefined;
});
afterEach(cleanup);

describe('remaining complex Plate toolbars/controllers', () => {
  it('builds every insert group and invokes every generated selection callback', () => {
    render(<InsertToolbarButton />);
    const props = mocks.childProps.find(item => item.name === 'insert-view').props;
    for (const group of props.groupsList) {
      for (const item of group.items) item.onSelect({ id: 'editor' }, item.value);
    }
    expect(mocks.insertBlock).toHaveBeenCalledTimes(17);
    expect(mocks.insertInline).toHaveBeenCalledTimes(3);
    expect(mocks.openData).toHaveBeenCalledOnce();
  });

  it('configures media upload/preview and runs the selected-file callback', () => {
    render(
      <>
        <MediaToolbarButton nodeType="audio" />
        <MediaPreviewDialog />
      </>
    );
    mocks.filePickerOptions.onFilesSuccessfullySelected({ plainFiles: [new File(['a'], 'a.mp3')] });
    expect(mocks.insertMedia).toHaveBeenCalledOnce();
    expect(screen.getByTestId('media-view')).toBeTruthy();
    expect(screen.getByTestId('preview-view')).toBeTruthy();
  });

  it('renders line-height action and all three element controllers', () => {
    const setValue = vi.fn();
    render(
      <LineHeightToolbarButtonView
        dropdownProps={{}}
        label="line height"
        open
        onOpenChange={vi.fn()}
        values={['1', '2']}
        value="1"
        onValueChange={setValue}
      />
    );
    expect(screen.getByText('2')).toBeTruthy();

    const elementProps = {
      attributes: {},
      children: null,
      className: 'class',
      element: { id: 'element' },
      editor: {},
    } as never;
    expect(
      renderHook(() => useCalloutElementController(elementProps)).result.current.calloutProps
    ).toEqual({ callout: true });
    expect(
      renderHook(() => useTocElementController(elementProps)).result.current.headingList
    ).toEqual(['h']);
    expect(renderHook(() => useToggleElementController(elementProps)).result.current.open).toBe(
      true
    );
  });
});
