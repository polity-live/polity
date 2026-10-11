import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { DatasetChartSource, DatasetProviderId } from '../types';
export type DataViewAttributionSource = Pick<
  DatasetChartSource,
  'provider' | 'publisher' | 'sourceUrl' | 'snapshotTakenAt'
>;
function providerLabel(provider: DatasetProviderId) {
  if (provider === 'GENESIS_DESTATIS') return 'GENESIS/Destatis';
  if (provider === 'GOVDATA') return 'GovData';
  if (provider === 'EUROSTAT') return 'Eurostat';
  return translateText('plateJs.dataView.ownData');
}
function normalizedLabel(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}
export function sourceLabel(source: DataViewAttributionSource) {
  const provider = providerLabel(source.provider);
  const publisher = source.publisher?.trim();
  if (!publisher) return provider;
  if (source.provider === 'UPLOAD') return publisher;
  return normalizedLabel(publisher) === normalizedLabel(provider)
    ? publisher
    : `${publisher} (${provider})`;
}
export function localizedDate(value: string | null | undefined, language?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat(language || undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
