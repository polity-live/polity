import * as React from 'react';
import { DownloadIcon, Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/features/shared/ui/ui/button';
import { prepareDatasetRawDownload } from '../api/datasetClient';
import type { DatasetRawDownloadTarget } from '../logic/datasetRawDownload';

export function DatasetProcessingError({
  message,
  target,
  accessToken,
  onRetry,
  hint,
  className,
  sourceUrl,
}: {
  message: string;
  target?: DatasetRawDownloadTarget;
  accessToken?: string | null;
  onRetry?: () => void;
  hint?: string;
  className?: string;
  sourceUrl?: string | null;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = React.useState(false);
  const [started, setStarted] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [readyUrl, setReadyUrl] = React.useState<string | null>(null);
  const pending = React.useRef<{ controller: AbortController; window: Window | null } | null>(null);
  const requestKey = JSON.stringify(target?.request);
  React.useEffect(() => {
    setBusy(false);
    setStarted(false);
    setFailed(false);
    setReadyUrl(null);
    return () => {
      pending.current?.controller.abort();
      pending.current?.window?.close();
      pending.current = null;
    };
  }, [requestKey, target?.file, message]);
  const stored = target?.request?.provider === 'UPLOAD';
  const label = target?.file ? 'original' : stored ? 'snapshot' : 'full';
  const download = async () => {
    if (!target || busy) return;
    setFailed(false);
    setStarted(false);
    if (target.file) {
      const url = URL.createObjectURL(target.file);
      const link = document.createElement('a');
      link.href = url;
      link.download = target.file.name;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStarted(true);
      return;
    }
    if (!target.request) return;
    // Reserve a user-initiated window before awaiting authentication/registry lookup.
    const popup = window.open('about:blank', '_blank');
    if (popup) {
      popup.opener = null;
      popup.document.title = t('plateJs.dataView.rawDownload.preparing');
      popup.document.body.textContent = t('plateJs.dataView.rawDownload.preparing');
    }
    const controller = new AbortController();
    pending.current = { controller, window: popup };
    setBusy(true);
    try {
      const prepared = await prepareDatasetRawDownload(
        target.request,
        accessToken,
        controller.signal
      );
      if (controller.signal.aborted) return;
      const url = new URL(prepared.url, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname !== '/api/datasets/raw-download')
        throw new Error('Invalid download destination');
      if (popup && !popup.closed) {
        popup.location.replace(url.toString());
        setStarted(true);
      } else setReadyUrl(url.toString());
    } catch {
      if (!controller.signal.aborted) {
        popup?.close();
        setFailed(true);
      }
    } finally {
      if (pending.current?.controller === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  };
  const sourceCandidate = sourceUrl ?? target?.sourceUrl;
  const source = sourceCandidate && /^https?:\/\//i.test(sourceCandidate) ? sourceCandidate : null;
  return (
    <div role="alert" className={`space-y-3 text-sm ${className ?? ''}`}>
      <p className="text-destructive">{message}</p>
      {hint && <p className="text-muted-foreground">{hint}</p>}
      {target?.file && (
        <p className="text-muted-foreground truncate text-xs" title={target.file.name}>
          {target.file.name}
        </p>
      )}
      {target && !target.file && (
        <p className="text-muted-foreground text-xs">
          {t(`plateJs.dataView.rawDownload.${stored ? 'snapshotHint' : 'fullHint'}`)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {target && (
          <Button
            data-action-id="charts.dataset-processing-error.download"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void download()}
          >
            {busy ? (
              <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
            {t(`plateJs.dataView.rawDownload.${busy ? 'preparing' : label}`)}
          </Button>
        )}
        {onRetry && (
          <Button
            data-action-id="charts.dataset-processing-error.retry"
            data-action-kind="interaction"
            variant="outline"
            size="sm"
            onClick={onRetry}
          >
            {t('plateJs.dataView.retrySearch')}
          </Button>
        )}
        {source && (
          <a
            data-action-id="charts.dataset-processing-error.source"
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {t('plateJs.dataView.rawDownload.openSource')}
          </a>
        )}
      </div>
      {readyUrl && (
        <a
          data-action-id="charts.dataset-processing-error.start-ready"
          href={readyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block underline"
          onClick={() => {
            setStarted(true);
            setReadyUrl(null);
          }}
        >
          {t(`plateJs.dataView.rawDownload.${label}`)}
        </a>
      )}
      <div role="status" aria-live="polite" className="text-muted-foreground text-xs">
        {busy
          ? t('plateJs.dataView.rawDownload.preparing')
          : started
            ? t('plateJs.dataView.rawDownload.started')
            : ''}
      </div>
      {failed && <p className="text-destructive">{t('plateJs.dataView.rawDownload.failed')}</p>}
    </div>
  );
}
