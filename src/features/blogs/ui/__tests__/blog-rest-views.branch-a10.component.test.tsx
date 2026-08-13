/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detailController: {} as Record<string, unknown>,
  editPage: {} as Record<string, unknown>,
  authUser: { id: 'user-1' } as { id: string } | undefined,
  navigate: vi.fn(),
  redirectProps: undefined as Record<string, unknown> | undefined,
  detailViewProps: undefined as Record<string, unknown> | undefined,
  editViewProps: undefined as Record<string, unknown> | undefined,
  mediaProps: [] as Record<string, unknown>[],
  settingsTabsProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../../hooks/useBlogDetailController', () => ({
  useBlogDetailController: () => mocks.detailController,
}));
vi.mock('../../hooks/useBlogEditPage', () => ({ useBlogEditPage: () => mocks.editPage }));
vi.mock('../../hooks/useResolvedBlogRedirectController', () => ({
  useResolvedBlogRedirectController: (props: Record<string, unknown>) => {
    mocks.redirectProps = props;
    return { status: 'loading' };
  },
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.authUser }) }));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  Navigate: (props: Record<string, unknown>) => (
    <div data-testid="navigate">{JSON.stringify(props)}</div>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/features/create/ui/CreateRecoveryState', () => ({
  CreateRecoveryState: () => <div>recovery</div>,
}));
vi.mock('../BlogDetailView', () => ({
  BlogDetailView: (props: Record<string, unknown>) => {
    mocks.detailViewProps = props;
    return <div>detail-view</div>;
  },
}));
vi.mock('../BlogEditView', async importOriginal => {
  const actual = await importOriginal<typeof import('../BlogEditView')>();
  return actual;
});
vi.mock('@/features/shared/ui/feedback', () => ({ PageSkeleton: () => <div>skeleton</div> }));
vi.mock('@/features/auth/ui/AccessDenied', () => ({ AccessDenied: () => <div>denied</div> }));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({
    children,
    type = 'button',
    ...props
  }: Record<string, unknown> & { children?: ReactNode; type?: 'button' | 'submit' | 'reset' }) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: Record<string, unknown>) => <input {...props} />,
  FormControlLabel: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => <label {...props}>{children}</label>,
  FormControlTextarea: (props: Record<string, unknown>) => <textarea {...props} />,
  SettingsActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsTabs: (props: Record<string, unknown> & { children?: ReactNode }) => {
    mocks.settingsTabsProps = props;
    return <div>{props.children}</div>;
  },
  VisibilitySelector: ({ onChange }: { onChange: (value: string) => void }) => (
    <button onClick={() => onChange('private')}>visibility</button>
  ),
}));
vi.mock('@/features/shared/ui/form/ValidatedInputField', () => ({
  ValidatedInputField: ({
    onChange,
    validator,
  }: {
    onChange: (value: string) => void;
    validator: (value: string) => boolean;
  }) => (
    <button
      type="button"
      data-valid={String(validator('valid'))}
      onClick={() => onChange('New title')}
    >
      validated-title
    </button>
  ),
}));
vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({
  VisibilityInput: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange('authenticated')}>
      edit-visibility
    </button>
  ),
}));
vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: (props: Record<string, unknown>) => {
    mocks.mediaProps.push(props);
    return (
      <div>
        <button
          type="button"
          onClick={() => (props.onImageChange as (url: string) => void)('image')}
        >
          image
        </button>
        <button
          type="button"
          onClick={() => (props.onVideoChange as (url: string) => void)('video')}
        >
          video
        </button>
        {props.onImageRemove ? (
          <button type="button" onClick={() => (props.onImageRemove as () => void)()}>
            remove-image
          </button>
        ) : null}
      </div>
    );
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagEditor: ({ onChange }: { onChange: (tags: string[]) => void }) => (
    <button type="button" onClick={() => onChange(['tag'])}>
      hashtags
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/carousel', () => ({
  Carousel: ({ children, setApi }: { children: ReactNode; setApi: (api: unknown) => void }) => (
    <div>
      <button onClick={() => setApi({})}>set-api</button>
      {children}
    </div>
  ),
  CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { BlogDetail } from '../BlogDetail';
import { BlogEdit } from '../BlogEdit';
import { BlogEditorView } from '../BlogEditorView';
import { BlogEditView } from '../BlogEditView';
import { CreateBlogFormView } from '../CreateBlogFormView';
import { ResolvedBlogRedirect } from '../ResolvedBlogRedirect';
import { ResolvedBlogRedirectView } from '../ResolvedBlogRedirectView';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.detailController = {};
  mocks.editPage = {
    formData: {},
    setFormData: vi.fn(),
    updateField: vi.fn(),
    removeImage: vi.fn(),
    handleSubmit: vi.fn(),
    isSubmitting: false,
    blog: {},
    isLoading: false,
    navigateToBlog: vi.fn(),
  };
  mocks.authUser = { id: 'user-1' };
  mocks.mediaProps = [];
});
afterEach(cleanup);

describe('remaining blog views A10', () => {
  it('switches BlogDetail between recovery and virtualized detail', () => {
    mocks.detailController = { isLoaded: false, recoveryDraft: { id: 'draft' } };
    const view = render(<BlogDetail blogId="blog-1" />);
    expect(screen.getByText('recovery')).toBeTruthy();
    mocks.detailController = { isLoaded: true, recoveryDraft: { id: 'draft' } };
    view.rerender(<BlogDetail blogId="blog-1" />);
    expect(mocks.detailViewProps?.virtualizeParticipationDirectory).toBe(true);
  });

  it('uses BlogEdit default and explicit tabs', () => {
    const view = render(<BlogEdit blogId="blog-1" />);
    expect(mocks.settingsTabsProps?.value).toBe('general');
    view.rerender(<BlogEdit blogId="blog-1" activeTab="tags" onTabChange={vi.fn()} />);
    expect(mocks.settingsTabsProps?.value).toBe('tags');
  });

  it('renders editor loading, editable, saving, change, and save states', () => {
    const change = vi.fn();
    const save = vi.fn();
    const view = render(
      <BlogEditorView
        content=""
        isLoaded={false}
        isSaving={false}
        onContentChange={change}
        onSave={save}
      />
    );
    expect(screen.getByText('skeleton')).toBeTruthy();
    view.rerender(
      <BlogEditorView
        blogTitle="Blog"
        content="body"
        isLoaded
        isSaving={false}
        onContentChange={change}
        onSave={save}
      />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('button'));
    expect(change).toHaveBeenCalledWith('new');
    expect(save).toHaveBeenCalled();
    view.rerender(
      <BlogEditorView content="body" isLoaded isSaving onContentChange={change} onSave={save} />
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('covers BlogEditView loading, missing, form callbacks, and saving', () => {
    const navigate = vi.fn();
    const updateField = vi.fn();
    const setFormData = vi.fn();
    const removeImage = vi.fn();
    const submit = vi.fn();
    const navigateToBlog = vi.fn();
    const base = {
      blogId: 'blog-1',
      navigate,
      t: (key: string) => key,
      formData: {
        title: 'Blog',
        date: '2026-08-09',
        imageURL: '',
        videoURL: '',
        visibility: 'public',
        hashtags: [],
      },
      setFormData,
      updateField,
      removeImage,
      handleSubmit: submit,
      isSubmitting: false,
      blog: {},
      isLoading: true,
      navigateToBlog,
      activeTab: 'general' as const,
    };
    const view = render(<BlogEditView {...base} />);
    expect(screen.getByText('skeleton')).toBeTruthy();
    view.rerender(<BlogEditView {...base} isLoading={false} blog={null} />);
    fireEvent.click(screen.getByRole('button'));
    expect(navigate).toHaveBeenCalledWith({ to: '/home' });
    view.rerender(<BlogEditView {...base} isLoading={false} />);
    for (const label of [
      'image',
      'video',
      'remove-image',
      'validated-title',
      'edit-visibility',
      'hashtags',
    ])
      fireEvent.click(screen.getByText(label));
    fireEvent.change(document.querySelector('input[type="date"]')!, {
      target: { value: '2026-08-10' },
    });
    fireEvent.click(screen.getByText('features.blogs.editPage.cancel'));
    expect(updateField).toHaveBeenCalled();
    expect(setFormData).toHaveBeenCalled();
    expect(removeImage).toHaveBeenCalled();
    expect(navigateToBlog).toHaveBeenCalled();
    view.rerender(<BlogEditView {...base} isLoading={false} isSubmitting />);
    expect(screen.getByText('features.blogs.editPage.saving')).toBeTruthy();
  });

  it('covers create blog field callbacks, carousel navigation, review fallbacks, and submit states', () => {
    const setFormData = vi.fn();
    const setCarouselApi = vi.fn();
    const submit = vi.fn();
    const carouselApi = { scrollTo: vi.fn(), scrollPrev: vi.fn(), scrollNext: vi.fn() };
    const base = {
      navigate: vi.fn(),
      user: {},
      createBlogFull: vi.fn(),
      blogId: 'blog-1',
      formData: {
        title: '',
        date: '2026-08-09',
        imageURL: '',
        videoURL: '',
        visibility: 'public',
        hashtags: [],
      },
      setFormData,
      isSubmitting: false,
      setIsSubmitting: vi.fn(),
      carouselApi,
      setCarouselApi,
      currentStep: 0,
      setCurrentStep: vi.fn(),
      handleSubmit: submit,
    };
    const view = render(<CreateBlogFormView {...base} />);
    fireEvent.change(screen.getByLabelText('generated.inline.0028_title_768e0c1c'), {
      target: { value: 'Blog' },
    });
    fireEvent.change(screen.getByLabelText('generated.inline.0277_date_eb9a4bc1'), {
      target: { value: '2026-08-10' },
    });
    for (const label of ['image', 'video', 'visibility', 'hashtags', 'set-api'])
      fireEvent.click(screen.getByText(label));
    fireEvent.click(screen.getAllByLabelText('common.accessibility.goToStep')[0]);
    expect(carouselApi.scrollTo).toHaveBeenCalled();
    view.rerender(
      <CreateBlogFormView
        {...base}
        currentStep={1}
        formData={{ ...base.formData, title: 'Blog', hashtags: ['tag'] }}
      />
    );
    fireEvent.click(screen.getByText('generated.inline.0046_previous_50f94286'));
    fireEvent.click(screen.getByText('generated.inline.0047_next_bc981983'));
    view.rerender(<CreateBlogFormView {...base} currentStep={2} />);
    fireEvent.click(screen.getByText('generated.inline.0039_create_blog_post_94626f08'));
    expect(submit).toHaveBeenCalled();
    view.rerender(<CreateBlogFormView {...base} currentStep={2} isSubmitting />);
    expect(screen.getByText('generated.inline.0013_creating_28ea7667')).toBeTruthy();
  });

  it('uses redirect default/explicit targets and renders every redirect status', () => {
    const redirect = render(<ResolvedBlogRedirect blogId="blog-1" />);
    expect(mocks.redirectProps).toEqual({ blogId: 'blog-1', target: 'detail' });
    redirect.rerender(<ResolvedBlogRedirect blogId="blog-1" target="edit" />);
    expect(mocks.redirectProps?.target).toBe('edit');
    redirect.unmount();

    const view = render(<ResolvedBlogRedirectView status="loading" />);
    view.rerender(<ResolvedBlogRedirectView status="recovery" draft={{} as never} />);
    expect(screen.getByText('recovery')).toBeTruthy();
    view.rerender(
      <ResolvedBlogRedirectView
        status="group"
        to="/group/$id/blog/$entryId"
        params={{ id: 'g', entryId: 'b' }}
      />
    );
    expect(screen.getByTestId('navigate')).toBeTruthy();
    view.rerender(
      <ResolvedBlogRedirectView
        status="user"
        to="/user/$id/blog/$entryId"
        params={{ id: 'u', entryId: 'b' }}
      />
    );
    view.rerender(<ResolvedBlogRedirectView status="denied" />);
    expect(screen.getByText('denied')).toBeTruthy();
  });
});
