/* @vitest-environment jsdom */
import { useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { createDocument } from '../../logic/templates';
import { getStudioRootFramesInLayerOrder } from '../../logic/frame-order';
import { legacyDocumentToV3 } from '../../logic/v3-adapter';
import type { StudioDocumentV3 } from '../../logic/document-v3';

vi.mock('../KonvaStudioCanvas', () => ({
  default: (props: { document: StudioDocumentV3; activeFrameId: string; fit: string }) => (
    <div
      data-testid="preview-canvas"
      data-page-id={props.activeFrameId}
      data-dimensions={(() => {
        const frame = props.document.nodes.find(node => node.id === props.activeFrameId);
        return frame ? `${frame.transform.width}x${frame.transform.height}` : '';
      })()}
      data-fit={props.fit}
    />
  ),
}));

import { StudioPreviewDialog } from '../StudioPreviewDialog';

const tr = (key: string) => key;

function PreviewHarness({
  document,
  activeFrameId,
}: {
  document: StudioDocumentV3;
  activeFrameId: string;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={opener} onClick={() => setOpen(true)}>
        Open
      </button>
      <StudioPreviewDialog
        document={document}
        assets={[]}
        activeFrameId={activeFrameId}
        open={open}
        onOpenChange={setOpen}
        returnFocusRef={opener}
        tr={tr}
      />
    </>
  );
}

afterEach(cleanup);

describe('Studio fullscreen preview', () => {
  it('preserves the previewed frame when selection changes and clears it when collaborators hide all frames', async () => {
    const document = legacyDocumentToV3(createDocument('carousel', 'Preview'));
    const frames = getStudioRootFramesInLayerOrder(document);
    const view = render(<PreviewHarness document={document} activeFrameId={frames[0].id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByTestId('preview-canvas');
    fireEvent.click(screen.getByRole('button', { name: 'nextFrame' }));
    view.rerender(<PreviewHarness document={document} activeFrameId={frames[2].id} />);
    expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[1].id);
    const hidden = structuredClone(document);
    hidden.nodes.forEach(node => {
      node.visible = false;
    });
    view.rerender(<PreviewHarness document={hidden} activeFrameId={frames[2].id} />);
    expect(screen.getByRole('status')).toHaveProperty('textContent', 'noVisibleFrames');
    expect(screen.queryByTestId('preview-canvas')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'closePreview' }));
    view.rerender(<PreviewHarness document={document} activeFrameId={frames[2].id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect((await screen.findByTestId('preview-canvas')).getAttribute('data-page-id')).toBe(
      frames[2].id
    );
  });
  it('advances and returns through native keyboard controls, disables boundary actions and restores focus after keyboard dismissal', async () => {
    const document = legacyDocumentToV3(createDocument('carousel', 'Preview'));
    const frames = getStudioRootFramesInLayerOrder(document);
    const before = JSON.stringify(document);
    render(<PreviewHarness document={document} activeFrameId={frames[0].id} />);
    const user = userEvent.setup();
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    await user.keyboard('{Enter}');
    await screen.findByTestId('preview-canvas');
    const previous = screen.getByRole('button', { name: 'previousFrame' });
    const next = screen.getByRole('button', { name: 'nextFrame' });
    const advance = screen.getByRole('button', { name: 'advancePreview' });
    expect(previous).toHaveProperty('disabled', true);
    expect(next).toHaveProperty('disabled', false);
    next.focus();
    expect(globalThis.document.activeElement).toBe(next);
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[1].id);
    previous.focus();
    expect(globalThis.document.activeElement).toBe(previous);
    await user.keyboard(' ');
    expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[0].id);
    advance.focus();
    expect(globalThis.document.activeElement).toBe(advance);
    for (let index = 1; index < frames.length; index++) {
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(
        frames[index].id
      );
    }
    expect(advance).toHaveProperty('disabled', true);
    expect(next).toHaveProperty('disabled', true);
    await user.click(advance);
    await user.click(next);
    expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(
      frames.at(-1)!.id
    );
    const close = screen.getByRole('button', { name: 'closePreview' });
    close.focus();
    expect(globalThis.document.activeElement).toBe(close);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(globalThis.document.activeElement).toBe(opener);
    expect(JSON.stringify(document)).toBe(before);
  });
  it('keeps an empty preview inert when collaborators hide every frame', async () => {
    const document = legacyDocumentToV3(createDocument('single', 'Empty preview'));
    document.nodes.forEach(node => {
      node.visible = false;
    });
    const change = vi.fn();
    const view = render(
      <StudioPreviewDialog
        document={document}
        assets={[]}
        activeFrameId={null}
        open
        onOpenChange={change}
        tr={tr}
      />
    );
    const dialog = await screen.findByRole('dialog');
    expect(screen.getByRole('status')).toHaveProperty('textContent', 'noVisibleFrames');
    expect(screen.queryByTestId('preview-canvas')).toBeNull();
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(
      screen.getAllByRole('button').filter(button => button.hasAttribute('disabled'))
    ).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'closePreview' }));
    expect(change).toHaveBeenCalledWith(false);
    view.unmount();
  });
  it('starts at the active frame, skips hidden frames and navigates without mutating the document', async () => {
    const document = legacyDocumentToV3(createDocument('carousel', 'Preview'));
    const frames = getStudioRootFramesInLayerOrder(document);
    frames[2].visible = false;
    frames[3].transform.width = 1440;
    frames[3].transform.height = 900;
    const before = JSON.stringify(document);

    const view = render(<PreviewHarness document={document} activeFrameId={frames[1].id} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    fireEvent.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'previewTitle' });
    const canvas = await screen.findByTestId('preview-canvas');
    expect(canvas.getAttribute('data-page-id')).toBe(frames[1].id);
    expect(screen.getByText('2 / 4')).toBeTruthy();

    fireEvent.click(canvas);
    await waitFor(() =>
      expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[3].id)
    );
    expect(screen.getByTestId('preview-canvas').getAttribute('data-dimensions')).toBe('1440x900');
    expect(screen.getByTestId('preview-canvas').getAttribute('data-fit')).toBe('contain');

    const previousButton = screen.getByRole('button', { name: 'previousFrame' });
    expect(screen.getByTestId('preview-advance-surface').contains(previousButton)).toBe(false);
    fireEvent.click(previousButton);
    expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[1].id);
    fireEvent.click(screen.getByRole('button', { name: 'nextFrame' }));
    expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[3].id);

    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[4].id);
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[4].id);
    expect((screen.getByRole('button', { name: 'nextFrame' }) as HTMLButtonElement).disabled).toBe(
      true
    );

    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[3].id);
    expect(JSON.stringify(document)).toBe(before);

    const collaborativeUpdate = structuredClone(document);
    const currentFrame = collaborativeUpdate.nodes.find(node => node.id === frames[3].id)!;
    currentFrame.visible = false;
    view.rerender(<PreviewHarness document={collaborativeUpdate} activeFrameId={frames[1].id} />);
    await waitFor(() =>
      expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[4].id)
    );

    fireEvent.click(screen.getByRole('button', { name: 'closePreview' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(globalThis.document.activeElement).toBe(opener);
  });

  it('falls back to the first visible frame when the active frame is hidden', async () => {
    const document = legacyDocumentToV3(createDocument('carousel', 'Preview'));
    const frames = getStudioRootFramesInLayerOrder(document);
    frames[1].visible = false;

    render(<PreviewHarness document={document} activeFrameId={frames[1].id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = await screen.findByRole('dialog', { name: 'previewTitle' });
    expect(screen.getByTestId('preview-canvas').getAttribute('data-page-id')).toBe(frames[0].id);
    expect(
      (screen.getByRole('button', { name: 'previousFrame' }) as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
