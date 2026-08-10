/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorToolbar } from '../EditorToolbar';

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ 'data-action-id': actionId, title, url }: any) => (
    <button type="button" data-action-id={actionId} data-title={title} data-url={url}>
      Share
    </button>
  ),
}));
vi.mock('../VersionControl', () => ({ VersionControl: () => null }));
vi.mock('../ModeSelector', () => ({ ModeSelector: () => null }));

afterEach(cleanup);

describe('EditorToolbar action contracts', () => {
  it('binds toolbar sharing to its stable consumer intent', () => {
    render(
      <EditorToolbar
        entityType="document"
        entityId="document-1"
        shareTitle="Public document"
        capabilities={{ sharing: true, presence: false, modeSelection: false, versioning: false }}
      />
    );

    const share = screen.getByRole('button', { name: 'Share' });
    expect(share.dataset.actionId).toBe('editor.toolbar.share.open');
    expect(share.dataset.title).toBe('Public document');
  });
});
