import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { DatasetProcessingError } from '../DatasetProcessingError';
import { prepareDatasetRawDownload } from '../../api/datasetClient';
import '@/i18n/i18n';
import '@/font-faces.css';
import '@/styles.css';
vi.mock('../../api/datasetClient', () => ({ prepareDatasetRawDownload: vi.fn() }));
const request = {
  provider: 'GENESIS_DESTATIS' as const,
  providerDatasetId: '13211-0002',
  language: 'de' as const,
};
beforeEach(() => {
  vi.mocked(prepareDatasetRawDownload).mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it.each([1280, 390])(
  'preserves the original upload File and offers keyboard-operable recovery at width %s',
  async width => {
    await page.viewport(width, 700);
    const file = new File([new Uint8Array([0xff, 0xfe, 0xe4, 0x00, 0x0a])], 'original.csv', {
      type: 'text/csv',
    });
    const create = vi.spyOn(URL, 'createObjectURL');
    const retry = vi.fn();
    render(
      <DatasetProcessingError message="CSV cannot be processed" target={{ file }} onRetry={retry} />
    );
    const button = screen.getByRole('button', { name: 'Download original file' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(create).toHaveBeenCalledWith(file);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(
      new Uint8Array([0xff, 0xfe, 0xe4, 0x00, 0x0a])
    );
    expect(prepareDatasetRawDownload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('CSV cannot be processed');
    await screen.findByText('Download started. Your browser manages the transfer.');
    await userEvent.click(screen.getByRole('button', { name: 'Search again' }));
    expect(retry).toHaveBeenCalledOnce();
  }
);
it('keeps import and download failures separate, preserves source access, and retries the exact identity', async () => {
  const popup = {
    opener: {},
    document: { title: '', body: { textContent: '' } },
    closed: false,
    close: vi.fn(),
    location: { replace: vi.fn() },
  };
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  vi.mocked(prepareDatasetRawDownload)
    .mockRejectedValueOnce(new Error('Source unavailable'))
    .mockResolvedValue({
      url: '/api/datasets/raw-download?ticket=test',
      fileName: '13211-0002.csv',
      kind: 'provider',
      fullDataset: true,
    });
  render(
    <DatasetProcessingError
      message="Import failed"
      accessToken="test-token"
      target={{ request, sourceUrl: 'https://genesis.destatis.de/' }}
    />
  );
  const button = screen.getByRole('button', { name: 'Download complete raw data' });
  await userEvent.click(button);
  await screen.findByText('The file could not be downloaded.');
  expect(screen.getByRole('alert')).toHaveTextContent('Import failed');
  expect(popup.close).toHaveBeenCalledOnce();
  expect(screen.getByRole('link', { name: 'Open source' })).toHaveAttribute(
    'href',
    'https://genesis.destatis.de/'
  );
  await userEvent.click(button);
  await screen.findByText('Download started. Your browser manages the transfer.');
  expect(vi.mocked(prepareDatasetRawDownload).mock.calls.at(-1)?.[0]).toEqual(request);
  expect(popup.opener).toBeNull();
  expect(popup.location.replace).toHaveBeenCalledWith(
    expect.stringContaining('/api/datasets/raw-download?ticket=test')
  );
});
it('aborts preparation on closing or selection change, and ignores an obsolete response', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof prepareDatasetRawDownload>>) => void;
  vi.mocked(prepareDatasetRawDownload).mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  const popup = {
    opener: null,
    document: { title: '', body: { textContent: '' } },
    closed: false,
    close: vi.fn(),
    location: { replace: vi.fn() },
  };
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  const view = render(<DatasetProcessingError message="Too large" target={{ request }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Download complete raw data' }));
  expect(screen.getByRole('button', { name: 'Preparing download' })).toBeDisabled();
  view.rerender(
    <DatasetProcessingError
      message="Other file failed"
      target={{ request: { ...request, providerDatasetId: '13211-0001' } }}
    />
  );
  expect(vi.mocked(prepareDatasetRawDownload).mock.calls[0][2]?.aborted).toBe(true);
  expect(popup.close).toHaveBeenCalledOnce();
  resolve({
    url: '/api/datasets/raw-download?ticket=obsolete',
    fileName: 'old.csv',
    kind: 'provider',
    fullDataset: true,
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Download complete raw data' })).toBeEnabled()
  );
  expect(popup.location.replace).not.toHaveBeenCalled();
});
it('labels stored CSV separately and still provides a native link when popups are blocked', async () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  vi.mocked(prepareDatasetRawDownload).mockResolvedValue({
    url: '/api/datasets/raw-download?ticket=test',
    fileName: 'stored.csv',
    kind: 'snapshot',
    fullDataset: false,
  });
  render(
    <DatasetProcessingError
      message="Stored CSV is unreadable"
      target={{ request: { provider: 'UPLOAD', snapshotId: 'snapshot' } }}
    />
  );
  await userEvent.click(screen.getByRole('button', { name: 'Download stored CSV' }));
  const link = await screen.findByRole('link', { name: 'Download stored CSV' });
  expect(link).toHaveAttribute(
    'href',
    expect.stringContaining('/api/datasets/raw-download?ticket=test')
  );
  expect(
    screen.getByText('This is the stored CSV snapshot, not the complete original file.')
  ).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('Stored CSV is unreadable');
  link.addEventListener('click', event => event.preventDefault(), { once: true });
  link.focus();
  await userEvent.keyboard('{Enter}');
  await screen.findByText('Download started. Your browser manages the transfer.');
});

it.each(['https://untrusted.test/api/datasets/raw-download', '/api/unexpected'])(
  'rejects a prepared destination outside the download endpoint: %s',
  async url => {
    const popup = {
      opener: null,
      document: { title: '', body: { textContent: '' } },
      closed: false,
      close: vi.fn(),
      location: { replace: vi.fn() },
    };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    vi.mocked(prepareDatasetRawDownload).mockResolvedValue({
      url,
      fileName: 'data.csv',
      kind: 'provider',
      fullDataset: true,
    });
    render(<DatasetProcessingError message="Import failed" target={{ request }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download complete raw data' }));
    await screen.findByText('The file could not be downloaded.');
    expect(popup.close).toHaveBeenCalledOnce();
    expect(popup.location.replace).not.toHaveBeenCalled();
  }
);

it('offers a fresh native download link when the reserved window was closed', async () => {
  const popup = {
    opener: null,
    document: { title: '', body: { textContent: '' } },
    closed: true,
    close: vi.fn(),
    location: { replace: vi.fn() },
  };
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  vi.mocked(prepareDatasetRawDownload).mockResolvedValue({
    url: '/api/datasets/raw-download?ticket=fresh',
    fileName: 'data.csv',
    kind: 'provider',
    fullDataset: true,
  });
  render(
    <DatasetProcessingError
      message="Import failed"
      target={{ request }}
      sourceUrl="javascript:alert(1)"
    />
  );
  await userEvent.click(screen.getByRole('button', { name: 'Download complete raw data' }));
  expect(await screen.findByRole('link', { name: 'Download complete raw data' })).toHaveAttribute(
    'href',
    expect.stringContaining('ticket=fresh')
  );
  expect(popup.location.replace).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: 'Open source' })).toBeNull();
});

it('keeps a target without a request inert and ignores cancelled preparation failures', async () => {
  const view = render(<DatasetProcessingError message="No download identity" target={{}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Download complete raw data' }));
  expect(prepareDatasetRawDownload).not.toHaveBeenCalled();
  let reject!: (reason: Error) => void;
  vi.mocked(prepareDatasetRawDownload).mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      })
  );
  vi.spyOn(window, 'open').mockReturnValue(null);
  view.rerender(<DatasetProcessingError message="Import failed" target={{ request }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Download complete raw data' }));
  view.rerender(<DatasetProcessingError message="Different import" />);
  reject(new Error('Cancelled transfer'));
  await waitFor(() => expect(screen.queryByText('The file could not be downloaded.')).toBeNull());
});
