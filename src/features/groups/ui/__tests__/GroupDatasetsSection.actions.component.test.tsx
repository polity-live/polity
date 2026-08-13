/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupDatasetsSection } from '../GroupDatasetsSection';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  upload: vi.fn(),
  archive: vi.fn(),
}));

vi.mock('@/features/charts/api/datasetClient', () => ({
  searchDatasets: mocks.search,
  uploadDataset: mocks.upload,
  archiveDataset: mocks.archive,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: { access_token: 'token' } }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? _key,
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.search.mockReset().mockResolvedValue([
    {
      id: 'dataset-1',
      provider: 'UPLOAD',
      title: 'Membership data',
      description: null,
      publisher: null,
      structureSummary: null,
      valueSummary: null,
      snapshotTakenAt: null,
      byteSize: 1000,
    },
  ]);
  mocks.upload.mockReset().mockResolvedValue(undefined);
  mocks.archive.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GroupDatasetsSection actions', () => {
  it('uploads and archives datasets through stable asynchronous actions', async () => {
    const { container } = render(<GroupDatasetsSection groupId="group-1" canManageDatasets />);
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });

    const upload = container.querySelector<HTMLElement>(
      '[data-action-id="groups.datasets.upload.file"]'
    )!;
    upload.focus();
    expect(document.activeElement).toBe(upload);
    const file = new File(['a,b\n1,2'], 'members.csv', { type: 'text/csv' });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({ file, groupId: 'group-1', title: 'members.csv' }),
      'token'
    );

    const archive = container.querySelector<HTMLElement>(
      '[data-action-id="groups.datasets.archive.dataset"]'
    )!;
    fireEvent.click(archive);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.archive).toHaveBeenCalledWith('dataset-1', 'token');
  });
});
