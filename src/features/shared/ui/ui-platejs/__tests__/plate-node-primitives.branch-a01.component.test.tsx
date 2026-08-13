/* @vitest-environment jsdom */

import React, { type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  streaming: false,
  streamingLeaf: undefined as any,
  selected: false,
  focused: false,
  readOnly: false,
  element: { lang: 'typescript' } as any,
  auth: { loading: false, session: { access_token: 'token' } } as any,
  media: { align: undefined, readOnly: false, unsafeUrl: '/audio.mp3' } as any,
  editor: {
    api: { findPath: vi.fn(() => [0]) },
    tf: { removeNodes: vi.fn(), setNodes: vi.fn() },
    getApi: vi.fn(),
  } as any,
  formatCode: vi.fn(),
  openChart: vi.fn(),
  clipboard: vi.fn(),
}));

vi.mock('platejs/react', async () => {
  const ReactModule = await import('react');
  const passthrough = ({ children, as: Tag = 'div', ...props }: any) => {
    const safe = { ...props };
    delete safe.editor;
    delete safe.element;
    delete safe.leaf;
    delete safe.text;
    delete safe.nodeProps;
    delete safe.disableDefaultStyles;
    return ReactModule.createElement(Tag, safe, children);
  };
  return {
    PlateElement: passthrough,
    PlateLeaf: passthrough,
    PlateText: passthrough,
    PlateContainer: passthrough,
    PlateContent: ReactModule.forwardRef(
      ({ disableDefaultStyles: _disableDefaultStyles, ...props }: any, ref) =>
        ReactModule.createElement('div', { ...props, ref })
    ),
    usePluginOption: () => state.streaming,
    useEditorRef: () => state.editor,
    useElement: () => state.element,
    useReadOnly: () => state.readOnly,
    useSelected: () => state.selected,
    useFocused: () => state.focused,
    withHOC: (_Provider: unknown, Component: unknown) => Component,
  };
});
vi.mock('platejs/static', async () => {
  const ReactModule = await import('react');
  const passthrough = ({ children, as: Tag = 'div', ...props }: any) => {
    const safe = { ...props };
    delete safe.editor;
    delete safe.element;
    delete safe.leaf;
    delete safe.text;
    return ReactModule.createElement(Tag, safe, children);
  };
  return { SlateElement: passthrough, SlateLeaf: passthrough };
});
vi.mock('platejs', () => ({
  NodeApi: { string: (node: { text?: string }) => node.text ?? 'code' },
  RangeApi: { isCollapsed: (selection: { collapsed?: boolean }) => Boolean(selection.collapsed) },
}));
vi.mock('@platejs/ai/react', () => ({ AIChatPlugin: { key: 'ai' } }));
vi.mock('@platejs/code-block', () => ({
  formatCodeBlock: (...args: unknown[]) => state.formatCode(...args),
  isLangSupported: (lang: string) => lang !== 'unsupported',
}));
vi.mock('@platejs/media/react', () => ({ useMediaState: () => state.media }));
vi.mock('@platejs/resizable', () => ({
  ResizableProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => state.auth }));
vi.mock('@/features/charts/ui/DataViewRenderer', () => ({
  DataViewRenderer: ({ accessToken }: { accessToken?: string }) => (
    <div data-testid="chart" data-token={accessToken} />
  ),
}));
vi.mock('@/features/charts/ui/ChartDialog', () => ({
  openDataViewDialog: (...args: unknown[]) => state.openChart(...args),
}));
vi.mock('@/features/shared/theme', () => ({
  getMotionPreset: () => 'motion',
  getSemanticToneClasses: () => ({ surface: 'surface' }),
  getPlateSurfaceClasses: () => 'plate-surface',
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/features/shared/ui/ui/command.tsx', () => ({
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandInput: ({ onValueChange, ...props }: any) => (
    <input aria-label="language-search" onChange={e => onValueChange(e.target.value)} {...props} />
  ),
  CommandItem: ({ children, onSelect, value }: any) => (
    <button onClick={() => onSelect(value)}>{children}</button>
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children, onCloseAutoFocus }: any) => (
    <div>
      <button aria-label="close-popover" onClick={onCloseAutoFocus} />
      {children}
    </div>
  ),
}));
vi.mock('../caption.tsx', () => ({
  Caption: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CaptionTextarea: (props: any) => <textarea aria-label="caption" {...props} />,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { AIAnchorElement, AILeaf } from '../ai-node';
import { CalloutElementStatic } from '../callout-node-static';
import { ChartElementStatic } from '../chart-node-static';
import { ChartElement } from '../chart-node';
import { CodeBlockElement, CodeLineElement, CodeSyntaxLeaf } from '../code-block-node';
import { CursorOverlayView } from '../CursorOverlayView';
import { Editor, EditorContainer } from '../editor';
import {
  HeadingElement,
  H1Element,
  H2Element,
  H3Element,
  H4Element,
  H5Element,
  H6Element,
} from '../heading-node';
import { ImageProgressView } from '../ImageProgressView';
import { AudioElement } from '../media-audio-node';
import { VideoElementStatic } from '../media-video-node-static';
import { TocElementView } from '../TocElementView';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  state.streaming = false;
  state.streamingLeaf = undefined;
  state.selected = false;
  state.focused = false;
  state.readOnly = false;
  state.element = { lang: 'typescript', text: 'code' };
  state.auth = { loading: false, session: { access_token: 'token' } };
  state.media = { align: undefined, readOnly: false, unsafeUrl: '/audio.mp3' };
  state.editor.getApi.mockReturnValue({ aiChat: { node: () => state.streamingLeaf } });
  vi.stubGlobal('navigator', { clipboard: { writeText: state.clipboard } });
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AI, cursor, editor and static primitives', () => {
  it('covers AI streaming identity combinations and the anchor element', () => {
    const text = { text: 'leaf' };
    const props = { editor: state.editor, text, leaf: text, children: 'AI' } as any;
    const view = render(<AILeaf {...props} />);
    expect(view.container.firstElementChild?.className).not.toContain('after:bg-primary');
    state.streamingLeaf = [text];
    state.streaming = true;
    view.rerender(<AILeaf {...props} />);
    expect(view.container.firstElementChild?.className).toContain('after:bg-primary');
    state.streamingLeaf = [{ text: 'other' }];
    view.rerender(<AILeaf {...props} />);
    expect(view.container.firstElementChild?.className).not.toContain('after:bg-primary');
    view.rerender(<AIAnchorElement {...({ children: 'anchor' } as any)} />);
    expect(view.container.querySelector('.h-\\[0\\.1px\\]')).toBeTruthy();
  });

  it('renders cursor selection/caret classes, defaults and streaming suppression', () => {
    const cursor = {
      id: 'selection',
      caretPosition: { top: 2 },
      data: { style: { color: 'red' } },
      selection: { collapsed: true },
      selectionRects: [{ left: 1 }],
    };
    const view = render(<CursorOverlayView cursors={[cursor]} />);
    expect(view.container.querySelector('.bg-primary')).toBeTruthy();
    view.rerender(
      <CursorOverlayView
        cursors={[{ ...cursor, id: 'drag', data: undefined, selection: { collapsed: false } }]}
      />
    );
    expect(view.container.querySelector('.bg-brand')).toBeTruthy();
    view.rerender(
      <CursorOverlayView cursors={[{ ...cursor, caretPosition: null, selectionRects: [] }]} />
    );
    expect(view.container.children).toHaveLength(0);
    state.streaming = true;
    view.rerender(<CursorOverlayView cursors={[cursor]} />);
    expect(view.container.children).toHaveLength(0);
  });

  it('renders editor variants and all heading wrappers', () => {
    const view = render(<EditorContainer variant="default" data-testid="container" />);
    expect(screen.getByTestId('container').className).toContain('plate-surface');
    view.rerender(<EditorContainer variant="comment" data-testid="container" />);
    expect(screen.getByTestId('container').className).not.toContain('plate-surface');
    view.rerender(<Editor variant="ai" data-testid="editor" />);
    expect(screen.getByTestId('editor')).toBeTruthy();
    view.rerender(<HeadingElement {...({ variant: null, children: 'fallback' } as any)} />);
    expect(screen.getByText('fallback').tagName).toBe('H1');
    for (const Component of [H1Element, H2Element, H3Element, H4Element, H5Element, H6Element]) {
      view.rerender(<Component {...({ children: Component.name } as any)} />);
      expect(screen.getByText(Component.name)).toBeTruthy();
    }
  });

  it('renders callout icon fallbacks, chart auth/read-only states, audio defaults and video captions', () => {
    const view = render(<CalloutElementStatic {...({ element: {}, children: 'body' } as any)} />);
    expect(screen.getByText('💡')).toBeTruthy();
    view.rerender(
      <CalloutElementStatic {...({ element: { icon: '✅' }, children: 'body' } as any)} />
    );
    expect(screen.getByText('✅')).toBeTruthy();

    state.auth = { loading: true, session: null };
    view.rerender(<ChartElementStatic {...({ element: {}, children: 'static' } as any)} />);
    expect(screen.queryByTestId('chart')).toBeNull();
    state.auth = { loading: false, session: { access_token: 'token' } };
    view.rerender(<ChartElementStatic {...({ element: {}, children: 'static' } as any)} />);
    expect(screen.getByTestId('chart').getAttribute('data-token')).toBe('token');

    state.readOnly = false;
    state.selected = true;
    state.focused = true;
    view.rerender(
      <ChartElement {...({ element: { id: 'chart' }, children: 'chart-child' } as any)} />
    );
    fireEvent.mouseDown(screen.getByTestId('plate-chart-toolbar'));
    fireEvent.pointerDown(screen.getByTestId('plate-chart-toolbar'));
    fireEvent.mouseDown(screen.getByTestId('plate-chart-interaction-surface'));
    fireEvent.pointerDown(screen.getByTestId('plate-chart-interaction-surface'));
    fireEvent.click(screen.getByTitle('plateJs.dataView.edit'));
    fireEvent.click(screen.getByTitle('plateJs.dataView.delete'));
    expect(state.openChart).toHaveBeenCalled();
    expect(state.editor.tf.removeNodes).toHaveBeenCalledWith({ at: [0] });
    state.editor.api.findPath.mockReturnValueOnce(null);
    fireEvent.click(screen.getByTitle('plateJs.dataView.delete'));
    state.readOnly = true;
    view.rerender(<ChartElement {...({ element: {}, children: 'read-only' } as any)} />);
    expect(screen.queryByTestId('plate-chart-toolbar')).toBeNull();

    view.rerender(<AudioElement {...({ element: {}, children: 'audio-child' } as any)} />);
    expect(screen.getByLabelText('caption')).toBeTruthy();
    state.media = { align: 'left', readOnly: true, unsafeUrl: '/other.mp3' };
    view.rerender(<AudioElement {...({ element: {}, children: 'audio-child' } as any)} />);

    view.rerender(
      <VideoElementStatic {...({ element: { url: '/v.mp4' }, children: 'video' } as any)} />
    );
    expect(view.container.querySelector('figcaption')).toBeNull();
    view.rerender(
      <VideoElementStatic
        {...({
          element: { align: 'left', url: '/v.mp4', caption: [{ text: 'Caption' }] },
          children: 'video',
        } as any)}
      />
    );
    expect(screen.getByText('Caption')).toBeTruthy();
  });
});

describe('code, progress and toc interactions', () => {
  it('covers code formatting, language search/select/fallback and copy completion', () => {
    const props = {
      editor: state.editor,
      element: state.element,
      children: 'const x = 1',
    } as any;
    const view = render(<CodeBlockElement {...props} />);
    fireEvent.click(screen.getByTitle('plateJs.toolbar.formatCode'));
    expect(state.formatCode).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('language-search'), { target: { value: 'python' } });
    fireEvent.click(screen.getByRole('button', { name: /Python/ }));
    expect(state.editor.tf.setNodes).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('close-popover'));
    fireEvent.click(view.container.querySelector('.sr-only')?.parentElement as Element);
    expect(state.clipboard).toHaveBeenCalledWith('code');
    act(() => vi.advanceTimersByTime(2000));

    state.element = { lang: '', text: 'code' };
    view.rerender(<CodeBlockElement {...({ ...props, element: state.element } as any)} />);
    expect(screen.getByRole('combobox').textContent).toBe('Plain Text');

    state.element = { lang: 'unsupported', text: 'code' };
    view.rerender(<CodeBlockElement {...({ ...props, element: state.element } as any)} />);
    expect(screen.queryByTitle('plateJs.toolbar.formatCode')).toBeNull();
    expect(screen.getByRole('combobox').textContent).toBe('Plain Text');
    state.readOnly = true;
    view.rerender(<CodeBlockElement {...({ ...props, element: state.element } as any)} />);
    expect(screen.queryByRole('combobox')).toBeNull();

    view.rerender(<CodeLineElement {...({ children: 'line' } as any)} />);
    view.rerender(
      <CodeSyntaxLeaf {...({ leaf: { className: 'token' }, children: 'syntax' } as any)} />
    );
    expect(screen.getByText('syntax').className).toContain('token');
  });

  it('covers image progress and table-of-contents empty/non-empty branches', () => {
    const file = new File(['image'], 'image.png');
    const view = render(<ImageProgressView file={file} progress={42.4} objectUrl={null} />);
    expect(view.container.firstElementChild).toBeNull();
    view.rerender(<ImageProgressView file={file} progress={42.4} objectUrl="blob:image" />);
    expect(screen.getByText('42%')).toBeTruthy();
    view.rerender(<ImageProgressView file={file} progress={100} objectUrl="blob:image" />);
    expect(screen.queryByText('100%')).toBeNull();

    const onClick = vi.fn();
    view.rerender(
      <TocElementView
        props={{ children: 'toc' }}
        t={(key: string) => key}
        btnProps={{ onClick }}
        headingList={[]}
        state={null}
      />
    );
    expect(screen.getByText('plateJs.toolbar.tableOfContents.createHeading')).toBeTruthy();
    view.rerender(
      <TocElementView
        props={{ children: 'toc' }}
        t={(key: string) => key}
        btnProps={{ onClick }}
        headingList={[{ id: 'h', title: 'Heading', depth: 2 }]}
        state={null}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));
    expect(onClick).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'h' }),
      'smooth'
    );
  });
});
