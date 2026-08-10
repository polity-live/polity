/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  showImage: true,
  imageUrl: 'https://images.example/preview.png' as string | undefined,
  scaleProps: { 'aria-label': 'scale-input' } as Record<string, unknown>,
}));

vi.mock('@platejs/media/react', () => ({
  PreviewImage: ({ className }: { className: string }) =>
    state.showImage ? (
      <div data-plate-preview className={className}>
        <img alt="preview" {...(state.imageUrl ? { src: state.imageUrl } : {})} />
      </div>
    ) : null,
  useScaleInput: () => ({ props: state.scaleProps, ref: vi.fn() }),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span>previous</span>,
  ArrowRight: () => <span>next</span>,
  Download: () => <span>download</span>,
  Minus: () => <span>zoom-out</span>,
  Plus: () => <span>zoom-in</span>,
  X: () => <span>close</span>,
}));

import {
  MediaPreviewDialogView,
  type MediaPreviewDialogViewProps,
} from '../MediaPreviewDialogView';

const handler = () => ({ onClick: vi.fn() });

function props(overrides: Partial<MediaPreviewDialogViewProps> = {}): MediaPreviewDialogViewProps {
  return {
    editor: {},
    isOpen: true,
    scale: 1.25,
    isEditingScale: false,
    closeProps: handler(),
    currentUrlIndex: 2,
    maskLayerProps: { onClick: vi.fn(), 'data-testid': 'mask' },
    nextDisabled: false,
    nextProps: handler(),
    prevDisabled: false,
    prevProps: handler(),
    scaleTextProps: { 'data-testid': 'scale-text' },
    zommOutProps: handler(),
    zoomInDisabled: false,
    zoomInProps: handler(),
    zoomOutDisabled: false,
    ...overrides,
  };
}

describe('MediaPreviewDialogView', () => {
  beforeEach(() => {
    state.showImage = true;
    state.imageUrl = 'https://images.example/preview.png';
    state.scaleProps = { 'aria-label': 'scale-input' };
  });

  afterEach(cleanup);

  it('renders open and closed navigation, zoom, scale, and mask states', () => {
    const stopPropagation = vi.fn();
    const initial = props();
    const { rerender } = render(<MediaPreviewDialogView {...initial} />);

    expect(screen.getByTestId('mask').className).not.toContain('hidden');
    expect(screen.getByText('3')).not.toBeNull();
    expect(screen.getByTestId('scale-text').textContent).toContain('125%');
    fireEvent.contextMenu(screen.getByTestId('mask'), { stopPropagation });
    fireEvent.click(screen.getByText('previous'));
    fireEvent.click(screen.getByText('next'));
    fireEvent.click(screen.getByText('zoom-out'));
    fireEvent.click(screen.getByText('zoom-in'));
    fireEvent.click(screen.getByText('close'));
    expect(initial.prevProps.onClick).toHaveBeenCalled();
    expect(initial.nextProps.onClick).toHaveBeenCalled();

    rerender(
      <MediaPreviewDialogView
        {...props({
          isOpen: false,
          currentUrlIndex: null,
          isEditingScale: true,
          prevDisabled: true,
          nextDisabled: true,
          zoomInDisabled: true,
          zoomOutDisabled: true,
        })}
      />
    );
    expect(screen.getByTestId('mask').className).toContain('hidden');
    expect(screen.getByText('1')).not.toBeNull();
    expect(screen.getByLabelText('scale-input')).not.toBeNull();
    expect(screen.getByText('previous').closest('button')?.className).toContain(
      'cursor-not-allowed'
    );
    expect(screen.getByText('next').closest('button')?.className).toContain('cursor-not-allowed');
    expect(screen.getByText('zoom-out').closest('button')?.className).toContain(
      'cursor-not-allowed'
    );
    expect(screen.getByText('zoom-in').closest('button')?.className).toContain(
      'cursor-not-allowed'
    );
  });

  it('downloads the preview through a temporary safe anchor', () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render(<MediaPreviewDialogView {...props()} />);

    fireEvent.click(screen.getByText('download'));

    expect(anchorClick).toHaveBeenCalledOnce();
    expect(document.body.querySelector('a')).toBeNull();
    anchorClick.mockRestore();
  });

  it('uses currentSrc as a fallback and ignores downloads without an image URL', () => {
    state.imageUrl = undefined;
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { rerender } = render(<MediaPreviewDialogView {...props()} />);
    const image = screen.getByAltText('preview');
    Object.defineProperty(image, 'currentSrc', {
      configurable: true,
      value: 'https://images.example/current.png',
    });
    fireEvent.click(screen.getByText('download'));
    expect(anchorClick).toHaveBeenCalledOnce();

    state.showImage = false;
    rerender(<MediaPreviewDialogView {...props()} />);
    fireEvent.click(screen.getByText('download'));
    expect(anchorClick).toHaveBeenCalledOnce();
    anchorClick.mockRestore();
  });
});
