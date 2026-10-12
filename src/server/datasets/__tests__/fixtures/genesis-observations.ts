/** Frozen FFCSV observations model the provider's separate time parts, blank totals and shuffled rows. */
export function genesisObservations(monthly = true) {
  const columns = [
    'statistics_code',
    'statistics_label',
    'time_code',
    'time_label',
    'time',
    '1_variable_code',
    '1_variable_label',
    '1_variable_attribute_code',
    '1_variable_attribute_label',
    '2_variable_code',
    '2_variable_label',
    '2_variable_attribute_code',
    '2_variable_attribute_label',
    'value',
    'value_unit',
    'value_variable_code',
    'value_variable_label',
  ];
  const rows: Record<string, string>[] = [];
  for (const month of monthly ? [3, 1, 12, 2, 8, 4, 11, 6, 5, 10, 7, 9] : [0])
    for (const [region, label] of [
      ['', 'Insgesamt'],
      ['DF', 'Früheres Bundesgebiet'],
      ['DN', 'Neue Länder'],
    ])
      for (const metric of ['ERW006', 'ERW112']) {
        rows.push(
          Object.fromEntries(
            columns.map((column, index) => [
              column,
              [
                '13211',
                'Arbeitsmarkt',
                'JAHR',
                'Jahr',
                '2025',
                monthly ? 'MONAT' : 'DINSGF',
                monthly ? 'Monate' : 'Gebiet',
                monthly ? `MONAT${String(month).padStart(2, '0')}` : region,
                monthly ? `Monat ${month}` : label,
                monthly ? 'DINSGF' : '',
                monthly ? 'Gebiet' : '',
                monthly ? region : '',
                monthly ? label : '',
                metric === 'ERW006' ? String(2_900_000 + month * 1000) : '6,2',
                metric === 'ERW006' ? 'Anzahl' : 'Prozent',
                metric,
                metric === 'ERW006' ? 'Arbeitslose' : 'Arbeitslosenquote',
              ][index],
            ])
          )
        );
      }
  return { columns, rows };
}
