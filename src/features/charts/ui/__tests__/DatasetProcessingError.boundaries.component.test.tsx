/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes } from 'react';
import { DatasetProcessingError } from '../DatasetProcessingError';
import { prepareDatasetRawDownload } from '../../api/datasetClient';

const handlers = vi.hoisted(() => ({
  button: null as ButtonHTMLAttributes<HTMLButtonElement> | null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../api/datasetClient', () => ({ prepareDatasetRawDownload: vi.fn() }));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: (props: ButtonHTMLAttributes<HTMLButtonElement>) => {
    handlers.button = props;
    return (
      <button disabled={props.disabled} onClick={props.onClick}>
        {props.children}
      </button>
    );
  },
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('releases the original-file object URL after the browser has begun its download', () => {
  const revoke = vi.fn();
  const create = vi.fn(() => 'blob:original');
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    }
  );
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const timers = vi.spyOn(window, 'setTimeout');
  const file = new File(['exact bytes'], 'original.csv');
  render(<DatasetProcessingError message="Import failed" target={{ file }} />);
  fireEvent.click(screen.getByRole('button'));
  expect(create).toHaveBeenCalledWith(file);
  expect(click).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toContain('started');
  const timer = timers.mock.calls.find(([, delay]) => delay === 10000)!;
  act(() => (timer[0] as () => void)());
  expect(revoke).toHaveBeenCalledWith('blob:original');
});

it('rejects duplicate preparation even if a button adapter invokes a disabled handler', async () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  let resolve!: (result: Awaited<ReturnType<typeof prepareDatasetRawDownload>>) => void;
  vi.mocked(prepareDatasetRawDownload).mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  render(
    <DatasetProcessingError
      message="Import failed"
      target={{ request: { provider: 'UPLOAD', snapshotId: 'snapshot' } }}
    />
  );
  fireEvent.click(screen.getByRole('button'));
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  await act(async () =>
    handlers.button!.onClick!(
      {} as Parameters<NonNullable<NonNullable<typeof handlers.button>['onClick']>>[0]
    )
  );
  expect(prepareDatasetRawDownload).toHaveBeenCalledOnce();
  await act(async () =>
    resolve({
      url: '/api/datasets/raw-download?ticket=one',
      fileName: 'snapshot.csv',
      kind: 'snapshot',
      fullDataset: false,
    })
  );
  expect(screen.getByRole('link').getAttribute('href')).toContain('ticket=one');
});
