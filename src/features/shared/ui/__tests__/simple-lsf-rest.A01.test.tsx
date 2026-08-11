/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alpha: vi.fn(),
  addressProps: [] as any[],
  handleFieldChange: vi.fn(),
  simpleController: vi.fn((_props: unknown) => ({ editor: 'controller' })),
  grid: vi.fn((options: unknown) => ({ ...(options as Record<string, unknown>), marker: 'grid' })),
}));

vi.mock('@/features/shared/hooks/useAlphaWarningDialogController', () => ({
  useAlphaWarningDialogController: mocks.alpha,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/form/GeoAddressInputField', () => ({
  GeoAddressInputField: (props: any) => {
    mocks.addressProps.push(props);
    return <button onClick={() => props.onChange(`value-${props.field}`)}>{props.field}</button>;
  },
}));
vi.mock('@/features/shared/hooks/useSimpleRichTextEditorController', () => ({
  useSimpleRichTextEditorController: (props: unknown) => mocks.simpleController(props),
}));
vi.mock('../form/SimpleRichTextEditorView', () => ({
  SimpleRichTextEditorView: (props: any) => <div data-testid="simple-editor">{props.id}</div>,
}));
vi.mock('@/features/shared/ui/form/FormFieldShell', () => ({
  FormFieldShell: ({ children }: any) =>
    children({ id: 'field', describedBy: 'description', invalid: false }),
}));
vi.mock('@/features/shared/ui/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, any>((props, ref) => <input ref={ref} {...props} />),
}));
vi.mock('@/features/shared/ui/ui/textarea', () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, any>((props, ref) => (
    <textarea ref={ref} {...props} />
  )),
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenuRadioGroup: ({ children }: any) => <div>{children}</div>,
  DropdownMenuRadioItem: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/layout/SurfaceDepthContext', () => ({
  SurfaceLayerProvider: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/logic/entityCardHelpers', () => ({
  getEntityIcon: () => (props: any) => <i {...props} />,
}));
vi.mock('@/features/shared/logic/typeaheadHelpers', () => ({
  getTypeaheadEntityLabel: (value: string) => value,
  highlightMatch: () => [],
}));
vi.mock('@/features/shared/logic/hashtagHelpers', () => ({ getHashtagGradient: () => 'tag' }));
vi.mock('@/features/shared/virtualization/grid-runtime/use-zero-grid-virtualizer', () => ({
  useZeroGridVirtualizer: (options: unknown) => mocks.grid(options),
}));

import { featureThemeRgba } from '../../theme';
import { AlphaWarningDialog } from '../AlphaWarningDialog';
import { PublicSiteFooter } from '../PublicSiteFooter';
import { CommentInputView } from '../comments/CommentInputView';
import { FieldGrid } from '../form/FieldLayout';
import { GeoAddressFieldsView } from '../form/GeoAddressFieldsView';
import { MiniPlateEditor } from '../form/MiniPlateEditor';
import { SimpleRichTextEditor } from '../form/SimpleRichTextEditor';
import { TextField } from '../form/TextField';
import { PanelFooter } from '../layout/Panel';
import { EditingModeMenuItems, getSelectableEditingModeOptions } from '../status/EditingMode';
import { TypeaheadResultCard } from '../typeahead/TypeaheadResultCard';
import { VotePasswordInputView } from '../voting/VotePasswordInputView';
import { usePolityZeroGrid } from '../../virtualization/usePolityZeroGrid';

describe('remaining shared simple views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addressProps = [];
  });
  afterEach(cleanup);

  it('covers theme, controller-only dialog, footer, layout, and editor facades', () => {
    expect(featureThemeRgba(1, 2, 3, 0.5)).toBe('rgba(1, 2, 3, 0.5)');
    render(<AlphaWarningDialog />);
    expect(mocks.alpha).toHaveBeenCalledOnce();

    const view = render(<PublicSiteFooter />);
    expect(view.container.querySelectorAll('a')).toHaveLength(4);
    view.rerender(<FieldGrid data-testid="grid" className="extra" />);
    expect(screen.getByTestId('grid').className).toContain('extra');
    view.rerender(<PanelFooter data-testid="footer" />);
    expect(screen.getByTestId('footer')).toBeTruthy();
    view.rerender(<MiniPlateEditor id="mini" value={[] as never} onChange={vi.fn()} />);
    expect(screen.getByTestId('simple-editor')).toBeTruthy();
    view.rerender(<SimpleRichTextEditor id="simple" value={[] as never} onChange={vi.fn()} />);
    expect(screen.getByTestId('simple-editor')).toBeTruthy();
  });

  it('invokes comment, text-field, and every geo-field callback', () => {
    const cancel = vi.fn();
    const submit = vi.fn();
    const setText = vi.fn();
    const blur = vi.fn();
    const valueChange = vi.fn();
    const view = render(
      <CommentInputView
        text="comment"
        setText={setText}
        isBusy={false}
        onSubmit={submit}
        onKeyDown={vi.fn()}
        placeholder="write"
        onCancelReply={cancel}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('write'), { target: { value: 'changed' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(cancel).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();

    view.rerender(<TextField multiline value="value" onValueChange={valueChange} onBlur={blur} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(blur).toHaveBeenCalledOnce();

    const fields = ['country', 'region', 'city', 'post_code', 'street', 'house_number'];
    const values = Object.fromEntries(fields.map(field => [field, ''])) as never;
    view.rerender(
      <GeoAddressFieldsView
        idPrefix="address"
        values={values}
        labels={values}
        placeholders={values}
        disabled={false}
        context={{}}
        onFieldChange={vi.fn()}
        onResolvedAddress={vi.fn()}
        resetContextKey="reset"
        setContext={vi.fn()}
        resolvedAddresses={[]}
        setResolvedAddresses={vi.fn()}
        handleResolved={vi.fn()}
        handleFieldChange={mocks.handleFieldChange}
      />
    );
    for (const field of fields) fireEvent.click(screen.getByRole('button', { name: field }));
    expect(mocks.handleFieldChange).toHaveBeenCalledTimes(6);
  });

  it('runs selectable editing options and the tooltip state callback', () => {
    expect(getSelectableEditingModeOptions((key: string) => key)).not.toHaveLength(0);
    render(
      <EditingModeMenuItems
        value="edit"
        onValueChange={vi.fn()}
        modes={['edit', 'suggest_event']}
        disabledModeReasons={{ edit: 'blocked' }}
      />
    );
    const help = screen.getByRole('button', { name: 'blocked' });
    fireEvent.pointerDown(help);
    fireEvent.click(help);
    fireEvent.click(help);
  });

  it('runs typeahead hashtag and voting input ref callbacks plus the grid facade', () => {
    const click = vi.fn();
    const view = render(
      <TypeaheadResultCard
        item={{ id: 'one', entityType: 'group', label: 'Group', hashtags: ['tag'] } as never}
        query=""
        onClick={click}
      />
    );
    fireEvent.mouseDown(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(click).toHaveBeenCalledOnce();

    const refs = { current: [] } as React.RefObject<(HTMLInputElement | null)[]>;
    view.rerender(
      <VotePasswordInputView
        digits={['1']}
        inputRefs={refs}
        onChange={vi.fn()}
        onKeyDown={vi.fn()}
        onPaste={vi.fn()}
      />
    );
    expect(refs.current[0]).toBeInstanceOf(HTMLInputElement);
    fireEvent.keyDown(refs.current[0]!);

    expect(renderHook(() => usePolityZeroGrid({ value: 1 })).result.current).toMatchObject({
      marker: 'grid',
      value: 1,
    });
  });
});
