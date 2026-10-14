import type {
  DatasetColumnProfile,
  DatasetMeasureOption,
  EurostatDimension,
} from '@/features/charts/types';
import { profileDatasetColumns, type DatasetTable } from './csv';

export const totalIdentity = (dimension: string) => `__total__:${dimension}`;

/** A blank code alone is missing data. Only an explicitly labelled official total gets an identity. */
export function normalizeGenesisTable(table: DatasetTable) {
  if (!table.columns.includes('value') || !table.columns.includes('time')) return table;
  const ids = new Set<string>();
  const rows = table.rows.map(row => {
    const result = { ...row };
    for (const column of table.columns.filter(name => /^\d+_variable_code$/.test(name))) {
      const prefix = column.replace(/_code$/, '');
      const id = row[column];
      if (!id) continue;
      ids.add(id);
      const code = row[`${prefix}_attribute_code`] ?? '';
      const label = row[`${prefix}_attribute_label`] ?? '';
      result[id] =
        !code && /^(Insgesamt|Total|All|Overall)$/i.test(label.trim()) ? totalIdentity(id) : code;
    }
    let period = row.time ?? '';
    const year = /^(\d{4})$/.exec(period)?.[1];
    if (year) {
      const month = /(?:MONAT|MONTH)?(0?[1-9]|1[0-2])$/i.exec(
        result.MONAT ?? result.MONTH ?? ''
      )?.[1];
      const quarter = /(?:QUARTAL|QUARTER|QUART|Q)?0?([1-4])$/i.exec(
        result.QUARTAL ?? result.QUARTER ?? result.QUART ?? ''
      )?.[1];
      const day = /(?:TAG|DAY)?(0?[1-9]|[12]\d|3[01])$/i.exec(result.TAG ?? result.DAY ?? '')?.[1];
      if (month)
        period = `${year}-${month.padStart(2, '0')}${day ? `-${day.padStart(2, '0')}` : ''}`;
      else if (quarter) period = `${year}-Q${quarter}`;
    }
    // ISO daily, monthly, quarterly and yearly dates retain their original precision.
    result.observation_period = period;
    return result;
  });
  return { columns: [...new Set([...table.columns, ...ids, 'observation_period'])], rows };
}

export function genesisSemantics(
  table: DatasetTable,
  dimensions: EurostatDimension[] = [],
  language = 'de',
  title = ''
) {
  const de = language === 'de';
  const normalized = normalizeGenesisTable(table);
  const dimensionIds = new Set(
    normalized.rows.flatMap(row => Object.keys(row).filter(id => /^[A-Z][A-Z0-9]+$/.test(id)))
  );
  const geo =
    dimensions.find(item => /DINSG|DLAND|LAND|KREIS|REGION|GEMEIN/i.test(item.id))?.id ??
    [...dimensionIds].find(id => /DINSG|DLAND|LAND|KREIS|REGION|GEMEIN/i.test(id));
  const actualDimensions: EurostatDimension[] = [
    ...dimensionIds,
    'value_variable_code',
    'value_unit',
  ]
    .filter(
      id =>
        normalized.columns.includes(id) &&
        !['MONAT', 'MONTH', 'QUARTAL', 'QUARTER', 'QUART', 'TAG', 'DAY'].includes(id)
    )
    .map((id, position) => {
      const original = dimensions.find(item => item.id === id);
      const firstRows = new Map<string, DatasetTable['rows'][number]>();
      for (const row of normalized.rows) if (!firstRows.has(row[id])) firstRows.set(row[id], row);
      return {
        id,
        position,
        label:
          original?.label ??
          (id === 'value_unit'
            ? de
              ? 'Einheit'
              : 'Unit'
            : id === 'value_variable_code'
              ? de
                ? 'Kennzahl'
                : 'Measure'
              : id),
        values: [...firstRows].map(([value, row]) => {
          const prefix = Object.keys(row)
            .find(key => /^\d+_variable_code$/.test(key) && row[key] === id)
            ?.replace(/_code$/, '');
          const label =
            id === 'value_variable_code'
              ? row.value_variable_label
              : prefix
                ? row[`${prefix}_attribute_label`]
                : value;
          return {
            id: value,
            label:
              value === totalIdentity(id) && id === 'DINSGF' && /Deutschland|Germany/i.test(title)
                ? de
                  ? 'Deutschland (Insgesamt)'
                  : 'Germany (Total)'
                : original?.values.find(item => item.id === value)?.label || label || value,
          };
        }),
      };
    });
  const measures = new Map<string, DatasetTable['rows'][number]>();
  for (const row of normalized.rows.filter(row => row.value_variable_code)) {
    const key = `${row.value_variable_code}\u0000${row.value_unit ?? ''}`;
    if (!measures.has(key)) measures.set(key, row);
  }
  const measureOptions: DatasetMeasureOption[] = [...measures].map(([key, row]) => {
    const [code, unit] = key.split('\u0000');
    return {
      id: `${code}:${encodeURIComponent(unit)}`,
      label: row.value_variable_label || code,
      unit,
      filters: {
        value_variable_code: code,
        ...(normalized.columns.includes('value_unit') ? { value_unit: unit } : {}),
      },
    };
  });
  const profiles: DatasetColumnProfile[] = profileDatasetColumns(normalized).map(profile => {
    const dimension = actualDimensions.find(item => item.id === profile.name);
    const semanticLabel = {
      observation_period: de ? 'Zeitraum' : 'Period',
      value: de ? 'Wert' : 'Value',
      value_variable_label: de ? 'Kennzahl' : 'Measure',
      value_unit: de ? 'Einheit' : 'Unit',
    }[profile.name];
    return {
      ...profile,
      label: semanticLabel || dimension?.label || profile.label,
      role:
        profile.name === 'value'
          ? 'measure'
          : profile.name === 'observation_period'
            ? 'time'
            : profile.name === geo
              ? 'geo'
              : dimension
                ? 'dimension'
                : 'label',
      type:
        profile.name === 'value'
          ? 'number'
          : profile.name === 'observation_period'
            ? 'date'
            : 'category',
      technical:
        !['value', 'observation_period', 'value_unit', 'value_variable_label'].includes(
          profile.name
        ) &&
        (!dimension || profile.name === 'value_variable_code'),
    };
  });
  return {
    table: normalized,
    profiles,
    metadata: {
      providerDimensions: actualDimensions,
      geoDimension: geo,
      timeDimension: 'observation_period',
      measureOptions,
    },
  };
}
