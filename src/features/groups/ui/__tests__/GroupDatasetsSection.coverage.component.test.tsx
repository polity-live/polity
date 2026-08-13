/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  upload: vi.fn(),
  archive: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  session: undefined as undefined | { access_token: string },
  uploadProps: undefined as any,
  textProps: undefined as any,
}));

vi.mock('@/features/charts/api/datasetClient', () => ({
  searchDatasets: mocks.search,
  uploadDataset: mocks.upload,
  archiveDataset: mocks.archive,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ session: mocks.session }) }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? _key,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/shared/ui/form', () => ({
  FileUploadTrigger: (props: any) => {
    mocks.uploadProps = props;
    return (
      <button data-testid="upload" disabled={props.disabled}>
        {props.children}
      </button>
    );
  },
  TextField: (props: any) => {
    mocks.textProps = props;
    return (
      <input
        data-testid="search"
        value={props.value}
        onChange={event => props.onValueChange(event.target.value)}
      />
    );
  },
}));

import { MAX_DATASET_SNAPSHOT_BYTES } from '@/features/charts/types';
import { GroupDatasetsSection, groupDatasetsSectionInternals } from '../GroupDatasetsSection';

const row = (extra: Record<string, unknown> = {}) => ({
  id: 'dataset-1',
  provider: 'UPLOAD' as const,
  title: 'Dataset',
  description: null,
  publisher: null,
  structureSummary: null,
  valueSummary: null,
  snapshotTakenAt: null,
  byteSize: null,
  ...extra,
});

async function startLoad() {
  await act(async () => {
    vi.advanceTimersByTime(250);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.search.mockReset();
  mocks.upload.mockReset();
  mocks.archive.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.session = undefined;
  mocks.uploadProps = undefined;
  mocks.textProps = undefined;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GroupDatasetsSection coverage', () => {
  it('formats every provider and byte-size variant', () => {
    const { providerLabel, formatBytes } = groupDatasetsSectionInternals;
    expect(
      ['EUROSTAT', 'GENESIS_DESTATIS', 'GOVDATA', 'UPLOAD'].map(value =>
        providerLabel(value as any)
      )
    ).toEqual(['Eurostat', 'Genesis/Destatis', 'GovData', 'Upload']);
    expect([
      formatBytes(),
      formatBytes(null),
      formatBytes(0),
      formatBytes(1000),
      formatBytes(1_500_000),
    ]).toEqual([null, null, null, '1 kB', '1.5 MB']);
  });

  it('shows loading, empty, rich read-only rows, and refreshes a changed query', async () => {
    let resolveSearch!: (value: any[]) => void;
    mocks.search.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSearch = resolve;
        })
    );
    const view = render(<GroupDatasetsSection groupId="group-1" canManageDatasets={false} />);
    await startLoad();
    expect(view.container.textContent).toContain('Loading datasets');
    await act(async () => resolveSearch([]));
    expect(view.container.textContent).toContain('No datasets found');

    mocks.search.mockResolvedValueOnce([
      row({
        id: 'eurostat',
        provider: 'EUROSTAT',
        snapshotTakenAt: '2026-08-09T00:00:00Z',
        byteSize: 1_500_000,
        description: 'Description',
        publisher: 'Publisher',
        structureSummary: 'Structure',
        valueSummary: 'Values',
      }),
      row({ id: 'genesis', provider: 'GENESIS_DESTATIS', byteSize: 500 }),
      row({ id: 'govdata', provider: 'GOVDATA', byteSize: 0 }),
    ]);
    fireEvent.change(view.getByTestId('search'), { target: { value: 'new query' } });
    await startLoad();
    expect(mocks.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'new query', accessToken: undefined })
    );
    expect(view.container.textContent).toContain('Description');
    expect(view.queryByTestId('upload')).toBeNull();
  });

  it.each([
    [new Error('load error'), 'load error'],
    ['bad load', 'Datasets could not be loaded'],
  ])('reports load failures', async (failure, message) => {
    mocks.search.mockRejectedValueOnce(failure);
    render(<GroupDatasetsSection groupId="group-1" canManageDatasets={false} />);
    await startLoad();
    expect(mocks.toastError).toHaveBeenCalledWith(message);
  });

  it('guards uploads and reports both upload failure forms while showing progress', async () => {
    mocks.session = { access_token: 'token' };
    mocks.search.mockResolvedValue([row()]);
    const view = render(<GroupDatasetsSection groupId="group-1" canManageDatasets />);
    await startLoad();
    await act(async () => mocks.uploadProps.onFilesSelected([] as unknown as FileList));
    expect(mocks.upload).not.toHaveBeenCalled();

    const tooLarge = new File(['x'], 'large.csv');
    Object.defineProperty(tooLarge, 'size', { value: MAX_DATASET_SNAPSHOT_BYTES + 1 });
    await act(async () => mocks.uploadProps.onFilesSelected([tooLarge] as unknown as FileList));
    expect(mocks.toastError).toHaveBeenCalledWith('Dataset snapshots are limited to 50 MiB');

    let rejectUpload!: (reason: unknown) => void;
    mocks.upload.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectUpload = reject;
        })
    );
    const file = new File(['a'], 'a.csv');
    let pending!: Promise<void>;
    act(() => {
      pending = Promise.resolve(mocks.uploadProps.onFilesSelected([file] as unknown as FileList));
    });
    expect(view.getByTestId('upload').hasAttribute('disabled')).toBe(true);
    await act(async () => rejectUpload(new Error('upload error')));
    await pending;
    expect(mocks.toastError).toHaveBeenCalledWith('upload error');

    mocks.upload.mockRejectedValueOnce('bad upload');
    await act(async () => mocks.uploadProps.onFilesSelected([file] as unknown as FileList));
    expect(mocks.toastError).toHaveBeenCalledWith('Dataset upload failed');
  });

  it('reports both archive failure forms and renders the archiving state', async () => {
    mocks.search.mockResolvedValue([row(), row({ id: 'dataset-2' })]);
    let rejectArchive!: (reason: unknown) => void;
    mocks.archive.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectArchive = reject;
        })
    );
    const view = render(<GroupDatasetsSection groupId="group-1" canManageDatasets />);
    await startLoad();
    let buttons = view.container.querySelectorAll<HTMLElement>(
      '[data-action-id="groups.datasets.archive.dataset"]'
    );
    fireEvent.click(buttons[0]);
    buttons = view.container.querySelectorAll<HTMLElement>(
      '[data-action-id="groups.datasets.archive.dataset"]'
    );
    expect(buttons[0].hasAttribute('disabled')).toBe(true);
    expect(buttons[1].hasAttribute('disabled')).toBe(false);
    await act(async () => rejectArchive(new Error('archive error')));
    expect(mocks.toastError).toHaveBeenCalledWith('archive error');

    mocks.archive.mockRejectedValueOnce('bad archive');
    fireEvent.click(buttons[1]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.toastError).toHaveBeenCalledWith('Dataset could not be archived');
  });
});
