/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MentionHashtagText } from '../MentionHashtagText';
import { RichTextPreview } from '../RichTextPreview';

const mocks = vi.hoisted(() => ({
  createSlateEditor: vi.fn((options: unknown) => ({ options })),
  editorStatic: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, search, to }: any) => (
    <a href={`${to}?${new URLSearchParams(search).toString()}`}>{children}</a>
  ),
}));

vi.mock('platejs', () => ({
  createSlateEditor: mocks.createSlateEditor,
}));

vi.mock('@/features/shared/ui/ui-platejs/editor-static', () => ({
  EditorStatic: (props: any) => {
    mocks.editorStatic(props);
    return <div data-testid="editor-static">rendered editor</div>;
  },
}));

vi.mock('@/features/shared/ui/kit-platejs/editor-base-kit', () => ({
  BaseEditorKit: ['base-editor-plugin'],
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rich-text display contracts', () => {
  it('tokenizes plain text, mentions, and hashtags into stable search links', () => {
    render(<MentionHashtagText className="copy" text="Hello @Ada about #Climate!" />);

    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByRole('link', { name: '@Ada' }).getAttribute('href')).toBe('/search?q=Ada');
    expect(screen.getByRole('link', { name: '#Climate' }).getAttribute('href')).toBe(
      '/search?hashtag=Climate'
    );
    expect(screen.getByText(/about/).parentElement?.classList.contains('copy')).toBe(true);
  });

  it('renders null or an explicitly styled fallback for empty rich-text content', () => {
    const { container, rerender } = render(<RichTextPreview content={null} />);

    expect(container.innerHTML).toBe('');

    rerender(<RichTextPreview content={[]} emptyText="No description" className="fallback" />);

    expect(screen.getByText('No description').className).toContain('text-muted-foreground');
    expect(screen.getByText('No description').className).toContain('fallback');
    expect(mocks.editorStatic).not.toHaveBeenCalled();
  });

  it('creates and renders a read-only editor with an accessible plain-text label', () => {
    const content = [{ type: 'p', children: [{ text: 'Council decision' }] }];

    render(<RichTextPreview content={content} className="preview" />);

    const preview = screen.getByLabelText('Council decision');
    expect(preview.className).toContain('w-full');
    expect(preview.className).toContain('text-sm');
    expect(preview.className).toContain('preview');
    expect(screen.getByTestId('editor-static')).toBeTruthy();
    expect(mocks.createSlateEditor).toHaveBeenCalledWith({
      plugins: ['base-editor-plugin'],
      value: content,
    });
    expect(mocks.editorStatic).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'none', editor: expect.any(Object) })
    );

    fireEvent.click(preview);
  });
});
