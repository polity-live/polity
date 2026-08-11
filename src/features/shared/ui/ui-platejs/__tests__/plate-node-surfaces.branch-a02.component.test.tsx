/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readOnly: false,
  selectionVisible: false,
  selected: false,
  focused: false,
  mounted: true,
  apple: false,
  dragging: false,
  dropLine: null as null | 'left' | 'right',
  editorMounted: true,
  resizableWidth: 480,
  draggableOptions: [] as Record<string, any>[],
  setNodes: vi.fn(),
  mentionSelect: vi.fn(),
  calendarProps: undefined as Record<string, any> | undefined,
  columnGroupProps: undefined as unknown,
  media: {
    align: undefined,
    embed: null,
    isUpload: false,
    isYoutube: false,
    readOnly: false,
    unsafeUrl: 'https://video.example',
  } as Record<string, any>,
}));

vi.mock('@platejs/dnd', () => ({
  useDraggable: (options: Record<string, any>) => {
    mocks.draggableOptions.push(options);
    return { isDragging: mocks.dragging, previewRef: vi.fn(), handleRef: vi.fn() };
  },
  useDropLine: () => ({ dropLine: mocks.dropLine }),
}));
vi.mock('@platejs/resizable', () => ({
  ResizableProvider: ({ children }: { children: ReactNode }) => children,
  useResizableValue: () => mocks.resizableWidth,
}));
vi.mock('@platejs/selection/react', () => ({ BlockSelectionPlugin: {} }));
vi.mock('@udecode/cn', () => ({ useComposedRef: (...refs: unknown[]) => refs[0] }));
vi.mock('@platejs/media', () => ({
  parseTwitterUrl: vi.fn(),
  parseVideoUrl: vi.fn(),
}));
vi.mock('@platejs/media/react', () => ({ useMediaState: () => mocks.media }));
vi.mock('@platejs/mention', () => ({
  getMentionOnSelectItem: () => mocks.mentionSelect,
}));
vi.mock('platejs', () => ({
  get IS_APPLE() {
    return mocks.apple;
  },
  KEYS: { bold: 'bold', italic: 'italic', underline: 'underline' },
  PathApi: {
    parent: (path: number[]) => path.slice(0, -1),
    equals: (left: number[], right: number[]) => JSON.stringify(left) === JSON.stringify(right),
  },
}));
vi.mock('platejs/react', () => ({
  withHOC: (_provider: unknown, Component: unknown) => Component,
  PlateElement: ({ as: Tag = 'div', children, attributes, ...props }: any) => {
    const safe = { ...props, ...attributes };
    delete safe.editor;
    delete safe.element;
    delete safe.nodeProps;
    return <Tag {...safe}>{children}</Tag>;
  },
  useReadOnly: () => mocks.readOnly,
  useSelected: () => mocks.selected,
  useFocused: () => mocks.focused,
  usePluginOption: () => mocks.selectionVisible,
  useEditorMounted: () => mocks.editorMounted,
}));
vi.mock('platejs/static', () => ({
  SlateElement: ({ children, element: _element, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/hooks/use-mounted.ts', () => ({ useMounted: () => mocks.mounted }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/tooltip.tsx', () => ({
  Tooltip: ({ children }: any) => children,
  TooltipContent: ({ children }: any) => <span>{children}</span>,
  TooltipProvider: ({ children }: any) => children,
  TooltipTrigger: ({ children }: any) => children,
}));
vi.mock('@/features/shared/ui/ui/calendar.tsx', () => ({
  Calendar: (props: Record<string, any>) => {
    mocks.calendarProps = props;
    return (
      <div>
        <button type="button" onClick={() => props.onSelect(undefined)}>
          no-date
        </button>
        <button type="button" onClick={() => props.onSelect(new Date('2026-08-15T12:00:00Z'))}>
          choose-date
        </button>
      </div>
    );
  },
}));
vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => children,
}));
vi.mock('@/features/shared/ui/rich-text', () => ({
  Resizable: ({ children }: any) => <div>{children}</div>,
  ResizeHandle: (props: any) => <div {...props} />,
  mediaResizeHandleVariants: ({ direction }: { direction: string }) => direction,
  InlineCombobox: ({ children, setValue, value }: any) => (
    <div data-value={value}>
      <button type="button" onClick={() => setValue('needle')}>
        search-mention
      </button>
      {children}
    </div>
  ),
  InlineComboboxContent: ({ children }: any) => <div>{children}</div>,
  InlineComboboxEmpty: ({ children }: any) => <div>{children}</div>,
  InlineComboboxGroup: ({ children }: any) => <div>{children}</div>,
  InlineComboboxInput: () => <input aria-label="mention-input" />,
  InlineComboboxItem: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('../caption.tsx', () => ({
  Caption: ({ children }: any) => <div>{children}</div>,
  CaptionTextarea: (props: any) => <textarea {...props} />,
}));
vi.mock('react-lite-youtube-embed', () => ({
  default: ({ id }: { id: string }) => <div data-testid="youtube">{id}</div>,
}));
vi.mock('react-player', () => ({
  default: ({ src }: { src: string }) => <div data-testid="player">{src}</div>,
}));
vi.mock('../ColumnGroupElementView', () => ({
  ColumnGroupElementView: ({ props }: { props: unknown }) => {
    mocks.columnGroupProps = props;
    return <div data-testid="column-group" />;
  },
}));

import { ColumnElement, ColumnGroupElement } from '../column-node';
import { DateElement } from '../date-node';
import { DateElementStatic } from '../date-node-static';
import { VideoElement } from '../media-video-node';
import { MentionElement, MentionInputElement } from '../mention-node';

const props = (element: Record<string, any>, children: ReactNode = <span>child</span>) =>
  ({
    element,
    children,
    attributes: {},
    editor: { tf: { setNodes: mocks.setNodes } },
  }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
  mocks.readOnly = false;
  mocks.selectionVisible = false;
  mocks.selected = false;
  mocks.focused = false;
  mocks.mounted = true;
  mocks.apple = false;
  mocks.dragging = false;
  mocks.dropLine = null;
  mocks.editorMounted = true;
  mocks.resizableWidth = 480;
  mocks.draggableOptions = [];
  mocks.calendarProps = undefined;
  mocks.media = {
    align: undefined,
    embed: null,
    isUpload: false,
    isYoutube: false,
    readOnly: false,
    unsafeUrl: 'https://video.example',
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('column node branch campaign A02', () => {
  it('covers widths, controls, dragging, drop directions, and group forwarding', () => {
    const view = render(<ColumnElement {...props({ id: 'column', width: 320 })} />);
    const options = mocks.draggableOptions.at(-1)!;
    expect(options.canDropNode({ dragEntry: [{}, [0, 1]], dropEntry: [{}, [0, 2]] })).toBe(true);
    expect(options.canDropNode({ dragEntry: [{}, [0, 1]], dropEntry: [{}, [1, 2]] })).toBe(false);
    const dragEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    const dragIcon = document.querySelector('svg')!;
    dragIcon.dispatchEvent(dragEvent);
    expect(dragEvent.defaultPrevented).toBe(true);

    mocks.dragging = true;
    mocks.dropLine = 'left';
    view.rerender(<ColumnElement {...props({ id: 'column', width: null })} />);
    expect(document.querySelector('.left-\\[-10\\.5px\\]')).toBeTruthy();
    mocks.dropLine = 'right';
    view.rerender(<ColumnElement {...props({ id: 'column' })} />);
    expect(document.querySelector('.right-\\[-11px\\]')).toBeTruthy();
    mocks.dropLine = null;
    mocks.readOnly = true;
    view.rerender(<ColumnElement {...props({ id: 'column' })} />);
    expect(screen.queryByRole('button')).toBeNull();
    mocks.readOnly = false;
    mocks.selectionVisible = true;
    view.rerender(<ColumnElement {...props({ id: 'column' })} />);
    expect(screen.queryByRole('button')).toBeNull();

    view.rerender(<ColumnGroupElement {...props({ id: 'group' })} />);
    expect(screen.getByTestId('column-group')).toBeTruthy();
    expect(mocks.columnGroupProps).toBeDefined();
  });
});

describe('date nodes branch campaign A02', () => {
  const values = [
    ['2026-08-09T12:00:00Z', 'dateElement.today'],
    ['2026-08-08T12:00:00Z', 'dateElement.yesterday'],
    ['2026-08-10T12:00:00Z', 'dateElement.tomorrow'],
    ['2026-07-01T12:00:00Z', 'July'],
  ] as const;

  it.each(values)('formats editable date %s', (date, expected) => {
    render(<DateElement {...props({ id: 'date', date })} />);
    expect(document.body.textContent).toContain(expected);
  });

  it('covers missing/read-only dates and calendar guards and mutation', () => {
    const view = render(<DateElement {...props({ id: 'date', date: null })} />);
    expect(screen.getByText('dateElement.pickDate')).toBeTruthy();
    fireEvent.click(screen.getByText('no-date'));
    expect(mocks.setNodes).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('choose-date'));
    expect(mocks.setNodes).toHaveBeenCalledWith(
      { date: expect.any(String) },
      { at: expect.objectContaining({ id: 'date' }) }
    );
    mocks.readOnly = true;
    view.rerender(<DateElement {...props({ id: 'date', date: '2026-08-09T12:00:00Z' })} />);
    expect(screen.queryByText('choose-date')).toBeNull();
  });

  it.each(values)('formats static date %s', (date, expected) => {
    render(<DateElementStatic {...props({ id: 'date', date })} />);
    expect(document.body.textContent).toContain(expected);
  });

  it('renders the static missing-date prompt', () => {
    render(<DateElementStatic {...props({ id: 'date', date: null })} />);
    expect(screen.getByText('dateElement.pickDate')).toBeTruthy();
  });
});

describe('mention nodes branch campaign A02', () => {
  it('covers non-Apple, styled, read-only, and Apple-mounted ordering', () => {
    const element = {
      id: 'mention',
      value: 'Ada',
      children: [{ text: '', bold: true, italic: true, underline: true }],
    };
    mocks.selected = true;
    mocks.focused = true;
    const view = render(<MentionElement {...props(element)} prefix="@" />);
    expect(document.body.textContent).toContain('@Adachild');

    mocks.apple = true;
    mocks.mounted = true;
    mocks.readOnly = true;
    mocks.selected = false;
    mocks.focused = false;
    view.rerender(
      <MentionElement
        {...props({ id: 'mention', value: 'Ada', children: [{ text: '' }] })}
        prefix="@"
      />
    );
    expect(document.body.textContent).toContain('child@Ada');

    mocks.apple = false;
    mocks.mounted = false;
    view.rerender(<MentionElement {...props(element)} prefix="@" />);
    expect(document.body.textContent).toContain('@Adachild');
  });

  it('searches mentionables and selects an item with current search', () => {
    render(<MentionInputElement {...props({ id: 'input' })} />);
    fireEvent.click(screen.getByText('search-mention'));
    fireEvent.click(screen.getByRole('button', { name: 'Aayla Secura' }));
    expect(mocks.mentionSelect).toHaveBeenCalledWith(
      expect.anything(),
      { key: '0', text: 'Aayla Secura' },
      'needle'
    );
  });
});

describe('media video node branch campaign A02', () => {
  it('renders YouTube, upload, and absent media alternatives with drag styling', () => {
    mocks.media = {
      align: 'left',
      embed: { id: 'youtube-id' },
      isUpload: false,
      isYoutube: true,
      readOnly: false,
      unsafeUrl: 'youtube-url',
    };
    mocks.dragging = true;
    const view = render(<VideoElement {...props({ id: 'video' })} />);
    expect(screen.getByTestId('youtube')).toBeTruthy();

    mocks.media = {
      align: undefined,
      embed: null,
      isUpload: true,
      isYoutube: false,
      readOnly: true,
      unsafeUrl: 'upload-url',
    };
    mocks.dragging = false;
    view.rerender(<VideoElement {...props({ id: 'video' })} />);
    expect(screen.getByTestId('player')).toBeTruthy();

    mocks.editorMounted = false;
    view.rerender(<VideoElement {...props({ id: 'video' })} />);
    expect(screen.queryByTestId('player')).toBeNull();

    mocks.media = {
      align: 'right',
      embed: null,
      isUpload: false,
      isYoutube: false,
      readOnly: false,
      unsafeUrl: 'none',
    };
    mocks.editorMounted = true;
    view.rerender(<VideoElement {...props({ id: 'video' })} />);
    expect(screen.queryByTestId('youtube')).toBeNull();
  });
});
