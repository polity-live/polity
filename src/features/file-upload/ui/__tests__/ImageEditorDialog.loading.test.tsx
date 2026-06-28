/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImageEditorDialog } from '../ImageEditorDialog';

vi.mock('react-filerobot-image-editor', () => new Promise(() => undefined));

afterEach(() => {
  cleanup();
});

describe('ImageEditorDialog loading state', () => {
  it('renders an editor-shaped Suspense skeleton', () => {
    render(
      <ImageEditorDialog
        imageUrl="data:image/png;base64,abc"
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn(async () => true)}
      />
    );

    expect(document.querySelector('[data-slot="image-editor-loading-skeleton"]')).toBeTruthy();
  });
});
