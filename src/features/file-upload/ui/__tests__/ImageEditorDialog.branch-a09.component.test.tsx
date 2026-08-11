// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageEditorDialog } from '../ImageEditorDialog';

const mocks = vi.hoisted(() => ({
  editorProps: null as any,
  dialogProps: null as any,
  forwardResults: [] as boolean[],
  toast: vi.fn(),
  buildTheme: vi.fn(() => ({ palette: {} })),
  readVar: vi.fn((_name: string, fallback: string) => fallback),
}));

vi.mock('react-filerobot-image-editor', () => ({
  default: (props: any) => {
    mocks.editorProps = props;
    return <div data-testid="vendor-editor" />;
  },
}));
vi.mock('styled-components', () => ({
  StyleSheetManager: ({ children, shouldForwardProp }: any) => {
    mocks.forwardResults = [
      shouldForwardProp('id', 'div'),
      shouldForwardProp('not a prop', 'div'),
      shouldForwardProp('anything', () => null),
    ];
    return children;
  },
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <>{children}</>,
  DialogTitle: ({ children }: any) => <h1>{children}</h1>,
  DialogContent: (props: any) => {
    mocks.dialogProps = props;
    return <div>{props.children}</div>;
  },
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({ Skeleton: () => <i /> }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.toast } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    language: 'de',
  }),
}));
vi.mock('../ImageEditorTheme', () => ({
  buildEditorTheme: mocks.buildTheme,
  readEditorCssVar: mocks.readVar,
  ImageEditorVendorStyles: () => <style />,
}));
vi.mock('../ImageEditorTooltipBridge', () => ({ ImageEditorTooltipBridge: () => <aside /> }));

async function renderEditor(overrides: Record<string, unknown> = {}) {
  const onOpenChange = vi.fn();
  const onSave = vi.fn(async () => true);
  const rendered = render(
    <ImageEditorDialog
      imageUrl="data:image/png;base64,source"
      open
      onOpenChange={onOpenChange}
      onSave={onSave}
      {...overrides}
    />
  );
  await waitFor(() => expect(mocks.editorProps).not.toBeNull());
  return { ...rendered, onOpenChange, onSave };
}

describe('ImageEditorDialog branch coverage', () => {
  beforeEach(() => {
    mocks.editorProps = null;
    mocks.dialogProps = null;
    mocks.forwardResults = [];
    mocks.toast.mockReset();
    mocks.buildTheme.mockClear();
    mocks.readVar.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns null without an image and configures the editor and portal interactions', async () => {
    const { container } = render(
      <ImageEditorDialog open onOpenChange={vi.fn()} onSave={vi.fn(async () => true)} />
    );
    expect(container.childElementCount).toBe(0);

    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 0 });
    const { onOpenChange } = await renderEditor();
    expect(mocks.editorProps).toEqual(
      expect.objectContaining({
        source: 'data:image/png;base64,source',
        language: 'de',
        previewPixelRatio: 1,
        closeAfterSave: false,
      })
    );
    expect(mocks.editorProps.onBeforeSave()).toBe(false);
    mocks.editorProps.onClose();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.forwardResults).toEqual([true, false, true]);

    const preventDefault = vi.fn();
    const portal = document.createElement('div');
    portal.id = 'SfxModal';
    const portalChild = document.createElement('button');
    portal.append(portalChild);
    document.body.append(portal);
    for (const handler of [
      mocks.dialogProps.onFocusOutside,
      mocks.dialogProps.onInteractOutside,
      mocks.dialogProps.onPointerDownOutside,
    ]) {
      handler({ detail: { originalEvent: { target: portalChild } }, preventDefault });
      handler({ detail: { originalEvent: { target: document.body } }, preventDefault });
      handler({ detail: { originalEvent: { target: null } }, preventDefault });
    }
    expect(preventDefault).toHaveBeenCalledTimes(3);
    portal.remove();
  });

  it('saves canvas data with explicit and fallback metadata and closes only on success', async () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await renderEditor({ onOpenChange, onSave });
    const canvas = {
      toBlob: vi
        .fn()
        .mockImplementationOnce((callback: (blob: Blob) => void) =>
          callback(new Blob(['first'], { type: 'image/jpeg' }))
        )
        .mockImplementationOnce((callback: (blob: Blob) => void) =>
          callback(new Blob(['second'], { type: 'image/png' }))
        ),
    };

    await mocks.editorProps.onSave({
      imageCanvas: canvas,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      fullName: 'full-name.jpg',
      quality: 0.5,
    });
    expect(onSave.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'full-name.jpg', type: 'image/jpeg' })
    );
    expect(canvas.toBlob.mock.calls[0].slice(1)).toEqual(['image/jpeg', 0.5]);
    expect(onOpenChange).not.toHaveBeenCalled();

    await mocks.editorProps.onSave({ imageCanvas: canvas, name: 'named' });
    expect(onSave.mock.calls[1][0]).toEqual(
      expect.objectContaining({ name: 'named.png', type: 'image/png' })
    );
    expect(canvas.toBlob.mock.calls[1].slice(1)).toEqual(['image/png', 0.92]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('falls back from an empty canvas to base64 and reports absent image data or save errors', async () => {
    const fetchMock = vi.fn(async () => ({ blob: async () => new Blob(['base64']) }));
    vi.stubGlobal('fetch', fetchMock);
    const onSave = vi.fn(async (_file: File) => true);
    await renderEditor({ onSave });

    await mocks.editorProps.onSave({
      imageCanvas: { toBlob: (callback: (blob: null) => void) => callback(null) },
      imageBase64: 'data:image/png;base64,abc',
      mimeType: 'imagecustom',
    });
    expect(fetchMock).toHaveBeenCalledWith('data:image/png;base64,abc');
    expect(onSave.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'edited-image.png', type: 'imagecustom' })
    );

    await mocks.editorProps.onSave({});
    expect(mocks.toast).toHaveBeenCalledWith('common.actions.uploadImageFailed');
    onSave.mockRejectedValueOnce(new Error('upload failed'));
    await mocks.editorProps.onSave({ imageBase64: 'data:image/png;base64,def' });
    expect(mocks.toast).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
