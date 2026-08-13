/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertEquation: vi.fn(),
  mediaToast: vi.fn(),
  setOption: vi.fn(),
  childProps: [] as any[],
}));

vi.mock('platejs/react', () => ({
  PlateElement: ({ children, as: Comp = 'div', ...props }: any) => (
    <Comp {...props}>{children}</Comp>
  ),
  PlateLeaf: ({ children, as: Comp = 'span', ...props }: any) => <Comp {...props}>{children}</Comp>,
  usePlateEditor: () => ({ id: 'ai-editor' }),
  useEditorRef: () => ({ id: 'editor' }),
  useEditorReadOnly: () => false,
  useEditorPlugin: () => ({ setOption: mocks.setOption }),
  usePluginOption: () => true,
}));
vi.mock('platejs/static', () => ({
  SlateElement: ({
    children,
    as: Comp = 'div',
    element: _element,
    editor: _editor,
    ...props
  }: any) => <Comp {...props}>{children}</Comp>,
  SlateLeaf: ({ children, as: Comp = 'span', leaf: _leaf, text: _text, ...props }: any) => (
    <Comp {...props}>{children}</Comp>
  ),
}));
vi.mock('@platejs/ai/react', () => ({ useAIChatEditor: vi.fn() }));
vi.mock('@/features/shared/ui/kit-platejs/editor-base-kit.tsx', () => ({ BaseEditorKit: [] }));
vi.mock('@platejs/caption/react', () => ({
  Caption: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CaptionTextarea: (props: any) => <textarea {...props} />,
  useCaptionButton: () => ({}),
  useCaptionButtonState: () => ({}),
}));
vi.mock('@udecode/cn', () => ({ createPrimitiveComponent: () => () => () => null }));
vi.mock('@platejs/math', () => ({ insertInlineEquation: mocks.insertEquation }));
vi.mock('@platejs/link/react', () => ({ useLink: () => ({ props: { href: '/link' } }) }));
vi.mock('@platejs/suggestion/react', () => ({ SuggestionPlugin: {} }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/ui/layout', () => ({
  ToolbarButton: ({ children, onClick, tooltip, ...props }: any) => (
    <button aria-label={tooltip} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuItem: ({ children, onSelect }: any) => <button onClick={onSelect}>{children}</button>,
}));

function controller(name: string) {
  return () => ({ name });
}
function view(name: string) {
  return (props: any) => {
    mocks.childProps.push({ name, props });
    return <div data-testid={name} />;
  };
}
vi.mock('@/features/shared/hooks/useExportToolbarButtonController', () => ({
  useExportToolbarButtonController: () => ({ open: false, setOpen: vi.fn() }),
}));
vi.mock('@/features/shared/hooks/useFontSizeToolbarButtonController', () => ({
  useFontSizeToolbarButtonController: controller('font'),
}));
vi.mock('@/features/shared/hooks/useMediaUploadToastController', () => ({
  useMediaUploadToastController: mocks.mediaToast,
}));
vi.mock('@/features/shared/hooks/useMoreToolbarButtonController', () => ({
  useMoreToolbarButtonController: controller('more'),
}));
vi.mock('@/features/shared/hooks/useTocElementStaticController', () => ({
  useTocElementStaticController: controller('toc-static'),
}));
vi.mock('@/features/shared/hooks/useTurnIntoToolbarButtonController', () => ({
  useTurnIntoToolbarButtonController: controller('turn'),
}));
vi.mock('../useCalloutElementController', () => ({
  useCalloutElementController: controller('callout'),
}));
vi.mock('../useMarkToolbarButtonController', () => ({
  useMarkToolbarButtonController: controller('mark'),
}));
vi.mock('../useToggleElementController', () => ({
  useToggleElementController: controller('toggle'),
}));
vi.mock('../editor-static.tsx', () => ({ EditorStatic: view('editor-static') }));
vi.mock('../CalloutElementView', () => ({ CalloutElementView: view('callout-view') }));
vi.mock('../ExportToolbarButtonView', () => ({ ExportToolbarButtonView: view('export-view') }));
vi.mock('../FloatingToolbarButtonsView', () => ({
  FloatingToolbarButtonsView: view('floating-view'),
}));
vi.mock('../FontSizeToolbarButtonView', () => ({ FontSizeToolbarButtonView: view('font-view') }));
vi.mock('../LinkElementView', () => ({ LinkElementView: view('link-view') }));
vi.mock('../MarkToolbarButtonView', () => ({ MarkToolbarButtonView: view('mark-view') }));
vi.mock('../MoreToolbarButtonView', () => ({ MoreToolbarButtonView: view('more-view') }));
vi.mock('../SuggestionToolbarButtonView', () => ({
  SuggestionToolbarButtonView: view('suggestion-view'),
}));
vi.mock('../TocElementStaticView', () => ({ TocElementStaticView: view('toc-view') }));
vi.mock('../ToggleElementView', () => ({ ToggleElementView: view('toggle-view') }));
vi.mock('../TurnIntoToolbarButtonView', () => ({ TurnIntoToolbarButtonView: view('turn-view') }));

import { AIChatEditor } from '../ai-chat-editor';
import { BlockquoteElementStatic } from '../blockquote-node-static';
import { CalloutElement } from '../callout-node';
import { Caption, CaptionTextarea } from '../caption';
import { CodeLeafStatic } from '../code-node-static';
import { CommentLeafStatic } from '../comment-node-static';
import { InlineEquationToolbarButton } from '../equation-toolbar-button';
import { ExportToolbarButton } from '../export-toolbar-button';
import { FloatingToolbarButtons } from '../floating-toolbar-buttons';
import { FontSizeToolbarButton } from '../font-size-toolbar-button';
import { HighlightLeaf } from '../highlight-node';
import { HrElementStatic } from '../hr-node-static';
import { ImportToolbarButtonView } from '../ImportToolbarButtonView';
import { KbdLeaf } from '../kbd-node';
import { LinkElementStatic } from '../link-node-static';
import { LinkElement } from '../link-node';
import { LinkToolbarButtonView } from '../LinkToolbarButtonView';
import { MarkToolbarButton } from '../mark-toolbar-button';
import { AudioElementStatic } from '../media-audio-node-static';
import { MediaUploadToast } from '../media-upload-toast';
import { MoreToolbarButton } from '../more-toolbar-button';
import { ParagraphElementStatic } from '../paragraph-node-static';
import { SuggestionToolbarButton } from '../suggestion-toolbar-button';
import { TocElementStatic } from '../toc-node-static';
import { ToggleElement } from '../toggle-node';
import { ToggleToolbarButtonView } from '../ToggleToolbarButtonView';
import { TurnIntoToolbarButton } from '../turn-into-toolbar-button';

afterEach(cleanup);

describe('remaining Plate surface facades', () => {
  const elementProps: any = {
    attributes: {},
    element: { id: 'element', url: '/audio' },
    editor: {},
    children: <span>child</span>,
  };

  it('renders static nodes, leaves, captions, and controller-backed views', () => {
    render(
      <>
        <AIChatEditor content="AI" />
        <BlockquoteElementStatic {...elementProps} />
        <CodeLeafStatic {...elementProps} />
        <CommentLeafStatic {...elementProps} />
        <HighlightLeaf {...elementProps} />
        <HrElementStatic {...elementProps} />
        <KbdLeaf {...elementProps} />
        <LinkElementStatic {...elementProps} />
        <AudioElementStatic {...elementProps} />
        <ParagraphElementStatic {...elementProps} />
        <Caption>caption</Caption>
        <CaptionTextarea aria-label="caption" />
        <CalloutElement {...elementProps} />
        <LinkElement {...elementProps} />
        <TocElementStatic {...elementProps} />
        <ToggleElement {...elementProps} />
      </>
    );
    expect(screen.getByTestId('editor-static')).toBeTruthy();
    expect(screen.getByLabelText('caption')).toBeTruthy();
  });

  it('renders toolbar facades and invokes their inline action', () => {
    render(
      <>
        <InlineEquationToolbarButton />
        <ExportToolbarButton />
        <FloatingToolbarButtons />
        <FontSizeToolbarButton />
        <LinkToolbarButtonView props={{}} state={{}} buttonProps={{}} t={(key: string) => key} />
        <MarkToolbarButton nodeType="bold" />
        <MediaUploadToast />
        <MoreToolbarButton />
        <SuggestionToolbarButton />
        <ToggleToolbarButtonView props={{}} state={{}} buttonProps={{}} t={(key: string) => key} />
        <TurnIntoToolbarButton />
        <ImportToolbarButtonView
          dropdownProps={{}}
          open={false}
          onOpenChange={vi.fn()}
          labels={{ import: 'import', importFromHTML: 'html', importFromMarkdown: 'markdown' }}
          onOpenHtmlFilePicker={vi.fn()}
          onOpenMarkdownFilePicker={vi.fn()}
        />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'plateJs.toolbar.equation' }));
    expect(mocks.insertEquation).toHaveBeenCalledOnce();
    expect(mocks.mediaToast).toHaveBeenCalledOnce();
  });
});
