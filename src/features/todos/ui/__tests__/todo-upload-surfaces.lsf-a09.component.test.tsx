/* @vitest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  todoPageProps: undefined as any,
  toolbarProps: undefined as any,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input {...props} />,
  FormControlLabel: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/card.tsx', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/file-upload/ui/ImageEditorDialog', () => ({
  ImageEditorDialog: () => <div />,
}));
vi.mock('@/features/file-upload/ui/FileDropzone', () => ({
  FileDropzone: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/pql/ui/PqlToolbar', () => ({
  PqlToolbar: (props: any) => {
    mocks.toolbarProps = props;
    return <div />;
  },
}));
vi.mock('../../hooks/useTodoDetailPage', () => ({
  useTodoDetailPage: () => ({
    todo: { id: 'todo' },
    canAccess: true,
    isEditing: false,
    isSaving: false,
    formData: {},
    setIsEditing: vi.fn(),
    handleSave: vi.fn(),
    handleCancel: vi.fn(),
    handleTitleChange: vi.fn(),
    handleFormUpdate: vi.fn(),
    discussion: {},
    canManageTodos: true,
    isArchiving: false,
    handleArchive: vi.fn(),
    handleUnarchive: vi.fn(),
  }),
}));
vi.mock('../../TodoDetailPageView', () => ({
  TodoDetailPageView: (props: any) => {
    mocks.todoPageProps = props;
    return <div />;
  },
}));

import { ImageUploadView } from '@/features/file-upload/ui/ImageUploadView';
import { TodoDetailPage } from '../../TodoDetailPage';
import { TodoArchiveBadge } from '../TodoArchiveAction';
import { TodoDetailHeader } from '../TodoDetailHeader';
import { TodosFilters } from '../TodosFilters';

it('executes image URL editing', () => {
  const onImageUrlChange = vi.fn();
  const view = render(
    <ImageUploadView
      label="Image"
      description="Description"
      urlInputId="url"
      isBusy={false}
      isEditorOpen={false}
      isUploading={false}
      copy={{
        previewAlt: 'Preview',
        dropImageHere: 'Drop',
        dragImageHere: 'Drag',
        orClickToBrowse: 'Browse',
        uploading: 'Uploading',
        uploadImage: 'Upload',
        orProvideUrl: 'URL',
        editImage: 'Edit',
      }}
      onEditorOpenChange={vi.fn()}
      onSaveEditedImage={vi.fn()}
      onRemoveImage={vi.fn()}
      onFilesSelected={vi.fn()}
      onFilesRejected={vi.fn()}
      onImageUrlChange={onImageUrlChange}
    />
  );
  fireEvent.change(view.getByTestId('image-upload-url-input'), {
    target: { value: 'https://image.test/a.png' },
  });
  expect(onImageUrlChange).toHaveBeenCalledWith('https://image.test/a.png');
});

it('renders todo page, archive badge, and filters', () => {
  render(<TodoDetailPage todoId="todo" />);
  expect(mocks.todoPageProps.todoId).toBe('todo');
  render(<TodoArchiveBadge />);
  render(
    <TodosFilters
      fields={[]}
      searchQuery=""
      setSearchQuery={vi.fn()}
      quickFilters={[]}
      quickFilterValues={{}}
      onQuickFilterValuesChange={vi.fn()}
      onQuickFilterToggle={vi.fn()}
      onQuickFilterClear={vi.fn()}
      savedFilters={[]}
      activeCustomFilterIds={[]}
      onCustomFilterToggle={vi.fn()}
      onCustomFilterDelete={vi.fn()}
      onCustomFilterSave={vi.fn()}
    />
  );
  expect(mocks.toolbarProps.searchPlaceholder).toBe('features.todos.search.placeholder');
});

it('executes todo title editing', () => {
  const onTitleChange = vi.fn();
  const view = render(
    <TodoDetailHeader
      isEditing
      isSaving={false}
      title="Todo"
      formTitle="Todo"
      onEdit={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      onTitleChange={onTitleChange}
    />
  );
  fireEvent.change(view.container.querySelector('input')!, { target: { value: 'Changed' } });
  expect(onTitleChange).toHaveBeenCalledWith('Changed');
});
