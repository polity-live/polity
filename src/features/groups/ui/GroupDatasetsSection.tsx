import * as React from 'react';
import { ArchiveIcon, Loader2Icon, UploadIcon } from 'lucide-react';
import { archiveDataset, searchDatasets, uploadDataset } from '@/features/charts/api/datasetClient';
import {
  MAX_DATASET_SNAPSHOT_BYTES,
  type DatasetProviderId,
  type DatasetSearchResult,
} from '@/features/charts/types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { FileUploadTrigger, TextField } from '@/features/shared/ui/form';
import { StateBadge, TokenBadge } from '@/features/shared/ui/status/StatusBadges';
import { Button } from '@/features/shared/ui/ui/button';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAuth } from '@/providers/auth-provider';

const DATASET_PROVIDERS: DatasetProviderId[] = [
  'EUROSTAT',
  'GENESIS_DESTATIS',
  'GOVDATA',
  'UPLOAD',
];

function providerLabel(provider: DatasetProviderId) {
  if (provider === 'EUROSTAT') return 'Eurostat';
  if (provider === 'GENESIS_DESTATIS') return 'Genesis/Destatis';
  if (provider === 'GOVDATA') return 'GovData';
  return translateText('features.groups.datasets.uploadProvider', 'Upload');
}

function formatBytes(value?: number | null) {
  if (!value) return null;
  if (value < 1_000_000) return `${Math.ceil(value / 1_000).toLocaleString()} kB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

export function GroupDatasetsSection({
  groupId,
  canManageDatasets,
}: {
  groupId: string;
  canManageDatasets: boolean;
}) {
  const { session } = useAuth();
  const [query, setQuery] = React.useState('');
  const [datasets, setDatasets] = React.useState<DatasetSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  const loadDatasets = React.useCallback(async () => {
    setLoading(true);
    try {
      const results = await searchDatasets({
        query,
        providers: DATASET_PROVIDERS,
        groupId,
        accessToken: session?.access_token,
      });
      setDatasets(results);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translateText('features.groups.datasets.loadFailed', 'Datasets could not be loaded')
      );
    } finally {
      setLoading(false);
    }
  }, [groupId, query, session?.access_token]);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDatasets();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [loadDatasets]);

  const handleUpload = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    if (file.size > MAX_DATASET_SNAPSHOT_BYTES) {
      toast.error(
        translateText(
          'features.groups.datasets.tooLarge',
          'Dataset snapshots are limited to 50 MiB'
        )
      );
      return;
    }

    setUploading(true);
    try {
      await uploadDataset(
        {
          file,
          groupId,
          title: file.name,
        },
        session?.access_token
      );
      toast.success(translateText('features.groups.datasets.uploaded', 'Dataset uploaded'));
      await loadDatasets();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translateText('features.groups.datasets.uploadFailed', 'Dataset upload failed')
      );
    } finally {
      setUploading(false);
    }
  };

  const handleArchive = async (datasetId: string) => {
    setArchivingId(datasetId);
    try {
      await archiveDataset(datasetId, session?.access_token);
      await loadDatasets();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translateText('features.groups.datasets.archiveFailed', 'Dataset could not be archived')
      );
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TextField
          id={`group-datasets-search-${groupId}`}
          label={translateText('features.groups.datasets.search', 'Search datasets')}
          value={query}
          onValueChange={setQuery}
          placeholder={translateText(
            'features.groups.datasets.searchPlaceholder',
            'Search title, provider, topic'
          )}
          className="min-w-64"
        />
        {canManageDatasets ? (
          <FileUploadTrigger
            inputProps={{
              accept: '.csv,.tsv,text/csv,text/tab-separated-values,text/plain',
            }}
            onFilesSelected={files => void handleUpload(files)}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
            {translateText('features.groups.datasets.upload', 'Upload CSV/TSV')}
          </FileUploadTrigger>
        ) : null}
      </div>

      <div className="divide-y border">
        {loading && datasets.length === 0 ? (
          <div className="text-muted-foreground flex min-h-28 items-center justify-center text-sm">
            <Loader2Icon className="mr-2 size-4 animate-spin" />
            {translateText('features.groups.datasets.loading', 'Loading datasets')}
          </div>
        ) : null}
        {!loading && datasets.length === 0 ? (
          <div className="text-muted-foreground flex min-h-28 items-center justify-center px-4 text-center text-sm">
            {translateText('features.groups.datasets.empty', 'No datasets found')}
          </div>
        ) : null}
        {datasets.map(dataset => (
          <div key={dataset.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <TokenBadge>{providerLabel(dataset.provider)}</TokenBadge>
                {dataset.snapshotTakenAt ? (
                  <StateBadge status="ready" tone="success">
                    {dataset.snapshotTakenAt.slice(0, 10)}
                  </StateBadge>
                ) : null}
                {formatBytes(dataset.byteSize) ? (
                  <StateBadge status="active" tone="neutral">
                    {formatBytes(dataset.byteSize)}
                  </StateBadge>
                ) : null}
              </div>
              <div>
                <p className="font-medium">{dataset.title}</p>
                {dataset.description ? (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {dataset.description}
                  </p>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">
                {[dataset.publisher, dataset.structureSummary, dataset.valueSummary]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {canManageDatasets ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={translateText('features.groups.datasets.archive', 'Archive dataset')}
                disabled={archivingId === dataset.id}
                onClick={() => void handleArchive(dataset.id)}
              >
                {archivingId === dataset.id ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ArchiveIcon className="size-4" />
                )}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
