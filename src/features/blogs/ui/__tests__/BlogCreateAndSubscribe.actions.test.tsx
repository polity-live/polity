/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlogSubscribeButtonView } from '../BlogSubscribeButtonView';
import { CreateBlogFormView, type CreateBlogFormViewProps } from '../CreateBlogFormView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/features/shared/ui/ui/carousel', () => ({
  Carousel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: () => <div data-testid="media-upload" />,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagEditor: () => <div data-testid="hashtag-editor" />,
}));

vi.mock('@/features/shared/ui/form', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/ui/form')>();
  return {
    ...actual,
    VisibilitySelector: () => <div data-testid="visibility-selector" />,
  };
});

afterEach(cleanup);

function createProps(overrides: Partial<CreateBlogFormViewProps> = {}): CreateBlogFormViewProps {
  return {
    blogId: 'blog-1',
    carouselApi: {
      scrollNext: vi.fn(),
      scrollPrev: vi.fn(),
      scrollTo: vi.fn(),
    },
    createBlogFull: vi.fn(),
    currentStep: 1,
    formData: {
      date: '2026-08-02',
      hashtags: [],
      imageURL: '',
      title: 'Covered blog',
      videoURL: '',
      visibility: 'public',
    },
    handleSubmit: vi.fn(),
    isSubmitting: false,
    navigate: vi.fn(),
    setCarouselApi: vi.fn(),
    setCurrentStep: vi.fn(),
    setFormData: vi.fn(),
    setIsSubmitting: vi.fn(),
    user: { id: 'user-1' },
    ...overrides,
  };
}

describe('blog creation and subscription action contracts', () => {
  it('navigates creation steps by stable selection and interaction actions', () => {
    const props = createProps();
    render(<CreateBlogFormView {...props} />);

    const stepButtons = screen.getAllByRole('button', {
      name: 'common.accessibility.goToStep',
    });
    expect(stepButtons.map(button => button.getAttribute('data-action-id'))).toEqual([
      'blogs.create.select-step',
      'blogs.create.select-step',
      'blogs.create.select-step',
    ]);
    fireEvent.click(stepButtons[2]!);
    expect(props.carouselApi.scrollTo).toHaveBeenCalledWith(2);

    const previous = screen.getByRole('button', {
      name: 'generated.inline.0046_previous_50f94286',
    });
    const next = screen.getByRole('button', { name: 'generated.inline.0047_next_bc981983' });
    expect(previous.getAttribute('data-action-id')).toBe('blogs.create.previous-step');
    expect(next.getAttribute('data-action-id')).toBe('blogs.create.next-step');
    fireEvent.click(previous);
    fireEvent.click(next);
    expect(props.carouselApi.scrollPrev).toHaveBeenCalledOnce();
    expect(props.carouselApi.scrollNext).toHaveBeenCalledOnce();
  });

  it('submits the final creation step and exposes its disabled loading state', () => {
    const handleSubmit = vi.fn();
    const view = render(<CreateBlogFormView {...createProps({ currentStep: 2, handleSubmit })} />);

    const submit = screen.getByRole('button', {
      name: 'generated.inline.0039_create_blog_post_94626f08',
    });
    expect(submit.getAttribute('data-action-id')).toBe('blogs.create.submit');
    fireEvent.click(submit);
    expect(handleSubmit).toHaveBeenCalledOnce();

    view.rerender(
      <CreateBlogFormView {...createProps({ currentStep: 2, handleSubmit, isSubmitting: true })} />
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'generated.inline.0013_creating_28ea7667',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('toggles blog subscription and disables repeated submission while loading', () => {
    const handleClick = vi.fn();
    const view = render(
      <BlogSubscribeButtonView
        blogId="blog-1"
        handleClick={handleClick}
        isLoading={false}
        isSubscribed={false}
        onSubscribeChange={vi.fn()}
        toggleSubscribe={vi.fn()}
      />
    );

    const subscribe = screen.getByRole('button', {
      name: 'generated.inline.0170_subscribe_d6981f74',
    });
    expect(subscribe.getAttribute('data-action-id')).toBe('blogs.subscribe.toggle');
    fireEvent.click(subscribe);
    expect(handleClick).toHaveBeenCalledOnce();

    view.rerender(
      <BlogSubscribeButtonView
        blogId="blog-1"
        handleClick={handleClick}
        isLoading
        isSubscribed
        onSubscribeChange={vi.fn()}
        toggleSubscribe={vi.fn()}
      />
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'generated.inline.0169_unsubscribe_834cc0ee',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});
