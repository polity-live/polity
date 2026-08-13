/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlogEditView, type BlogEditViewProps } from '../BlogEditView';
import { BlogEditorView } from '../BlogEditorView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
}));

vi.mock('@/features/shared/ui/form', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/ui/form')>();
  return {
    ...actual,
    SettingsActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SettingsPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
    SettingsTabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('@/features/shared/ui/ui/tabs', () => ({
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: () => <div data-testid="media-upload" />,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagEditor: () => <div data-testid="hashtag-editor" />,
}));

vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({
  VisibilityInput: () => <div data-testid="visibility-input" />,
}));

vi.mock('@/features/shared/ui/form/ValidatedInputField', () => ({
  ValidatedInputField: () => <input aria-label="validated title" />,
}));

afterEach(cleanup);

const t = (key: string) => key;

function editProps(overrides: Partial<BlogEditViewProps> = {}): BlogEditViewProps {
  return {
    activeTab: 'general',
    blog: { id: 'blog-1' },
    blogId: 'blog-1',
    formData: {
      date: '2026-08-02',
      hashtags: [],
      imageURL: '',
      title: 'Covered blog',
      videoURL: '',
      visibility: 'public',
    },
    handleSubmit: vi.fn((event: { preventDefault(): void }) => event.preventDefault()),
    isLoading: false,
    isSubmitting: false,
    navigate: vi.fn(),
    navigateToBlog: vi.fn(),
    onTabChange: vi.fn(),
    removeImage: vi.fn(),
    setFormData: vi.fn(),
    t,
    updateField: vi.fn(),
    ...overrides,
  };
}

describe('blog editing action contracts', () => {
  it('navigates from a missing blog and submits or cancels an editable blog through stable actions', () => {
    const navigate = vi.fn();
    const missing = render(<BlogEditView {...editProps({ blog: null, navigate })} />);

    const back = screen.getByRole('button', { name: 'features.blogs.editPage.backToBlogs' });
    expect(back.getAttribute('data-action-id')).toBe('blogs.edit.back-to-blogs');
    fireEvent.click(back);
    expect(navigate).toHaveBeenCalledWith({ to: '/home' });

    missing.unmount();

    const handleSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    const navigateToBlog = vi.fn();
    render(<BlogEditView {...editProps({ handleSubmit, navigateToBlog })} />);

    const form = screen
      .getByRole('button', {
        name: 'features.blogs.editPage.saveChanges',
      })
      .closest('form');
    expect(form?.getAttribute('data-action-id')).toBe('blogs.edit.save.form-submit');

    const cancel = screen.getByRole('button', { name: 'features.blogs.editPage.cancel' });
    expect(cancel.getAttribute('data-action-id')).toBe('blogs.edit.cancel');
    fireEvent.click(cancel);
    expect(navigateToBlog).toHaveBeenCalledOnce();

    fireEvent.submit(form!);
    expect(handleSubmit).toHaveBeenCalledOnce();
  });

  it('locks editor save while persisting and forwards content changes', () => {
    const onContentChange = vi.fn();
    const onSave = vi.fn();
    const view = render(
      <BlogEditorView
        blogTitle="Covered blog"
        content="Draft"
        isLoaded
        isSaving={false}
        onContentChange={onContentChange}
        onSave={onSave}
      />
    );

    const save = screen.getByRole('button', { name: /save/i });
    expect(save.getAttribute('data-action-id')).toBe('blogs.editor.save');
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated' } });
    expect(onContentChange).toHaveBeenCalledWith('Updated');

    view.rerender(
      <BlogEditorView
        blogTitle="Covered blog"
        content="Updated"
        isLoaded
        isSaving
        onContentChange={onContentChange}
        onSave={onSave}
      />
    );
    expect((screen.getByRole('button', { name: /saving/i }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
