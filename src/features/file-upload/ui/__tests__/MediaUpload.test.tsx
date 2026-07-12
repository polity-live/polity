// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaUpload } from '../MediaUpload';

afterEach(cleanup);

vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../ImageUpload', () => ({
  ImageUpload: ({
    onImageChange,
    onFileUpload,
  }: {
    onImageChange: (url: string) => void;
    onFileUpload?: (file: File) => Promise<string>;
  }) => (
    <>
      <button type="button" onClick={() => onImageChange('image.jpg')}>
        choose image
      </button>
      <span data-testid="custom-image-upload">{String(Boolean(onFileUpload))}</span>
    </>
  ),
}));

vi.mock('../VideoUpload', () => ({
  VideoUpload: ({ onVideoChange }: { onVideoChange: (url: string) => void }) => (
    <button type="button" onClick={() => onVideoChange('video.mp4')}>
      choose video
    </button>
  ),
}));

describe('MediaUpload', () => {
  it('clears the video when an image is selected in exclusive mode', () => {
    const onImageChange = vi.fn();
    const onVideoChange = vi.fn();
    render(
      <MediaUpload
        currentImage=""
        currentVideo="video.mp4"
        onImageChange={onImageChange}
        onVideoChange={onVideoChange}
        entityType="events"
        entityId="event-id"
        exclusiveMedia
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'choose image' }));

    expect(onImageChange).toHaveBeenCalledWith('image.jpg');
    expect(onVideoChange).toHaveBeenCalledWith('');
  });

  it('clears the image when a video is selected in exclusive mode', () => {
    const onImageChange = vi.fn();
    const onVideoChange = vi.fn();
    render(
      <MediaUpload
        currentImage="image.jpg"
        currentVideo=""
        onImageChange={onImageChange}
        onVideoChange={onVideoChange}
        entityType="events"
        entityId="event-id"
        exclusiveMedia
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'choose video' }));

    expect(onVideoChange).toHaveBeenCalledWith('video.mp4');
    expect(onImageChange).toHaveBeenCalledWith('');
  });

  it('passes a custom image upload handler through to the image tab', () => {
    const onImageFileUpload = vi.fn(async () => 'avatar.jpg');
    render(
      <MediaUpload
        onImageChange={vi.fn()}
        onImageFileUpload={onImageFileUpload}
        onVideoChange={vi.fn()}
        entityType="users"
        entityId="user-id"
      />
    );

    expect(screen.getByTestId('custom-image-upload').textContent).toBe('true');
  });
});
