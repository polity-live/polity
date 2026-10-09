import { median, percentile, REPETITIONS, type Measurement } from './metrics';

function statistic(values: number[], fraction?: number) {
  if (!values.length || values.some(value => !Number.isFinite(value) || value < 0))
    return 'missing' as const;
  return fraction === undefined ? median(values) : percentile(values, fraction);
}

/** One schema for worker, collector, progress and failure-path summaries. */
export function measurementSummary(measurement: Measurement) {
  const exportMs = (measurement.plans as { exportMs?: number } | null)?.exportMs;
  return {
    query: measurement.key,
    totalMedianMs: statistic(measurement.samples.map(sample => sample.totalMs)),
    totalMaxMs: statistic(
      measurement.samples.map(sample => sample.totalMs),
      1
    ),
    clientMaxMs: statistic(
      measurement.samples.map(sample => sample.clientMs),
      1
    ),
    serverMedianMs: statistic(measurement.samples.map(sample => sample.serverMs)),
    serverMaxMs: statistic(
      measurement.samples.map(sample => sample.serverMs),
      1
    ),
    analyzerMs:
      measurement.analyzeMs.length === REPETITIONS.analyze
        ? statistic(measurement.analyzeMs)
        : 'missing',
    planExportMs: statistic([exportMs ?? NaN]),
    authMedianMs: statistic(measurement.samples.map(sample => sample.api?.authMs ?? NaN)),
    transformMedianMs: statistic(measurement.samples.map(sample => sample.api?.transformMs ?? NaN)),
    apiMedianMs: statistic(measurement.samples.map(sample => sample.api?.requestMs ?? NaN)),
    readRows: measurement.readRows,
    scannedRows: measurement.scannedRows,
    failures: measurement.failures.join('; '),
  };
}

const COLUMNS = [
  'query',
  'totalMedianMs',
  'totalMaxMs',
  'clientMaxMs',
  'serverMedianMs',
  'serverMaxMs',
  'analyzerMs',
  'planExportMs',
  'authMedianMs',
  'transformMedianMs',
  'apiMedianMs',
  'readRows',
  'scannedRows',
  'failures',
] as const;

export function resultsCSV(measurements: Measurement[]) {
  return [
    COLUMNS.join(','),
    ...measurements.map(measurement => {
      const row = measurementSummary(measurement);
      return COLUMNS.map(column => JSON.stringify(row[column])).join(',');
    }),
  ].join('\n');
}
