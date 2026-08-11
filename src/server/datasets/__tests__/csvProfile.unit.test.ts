import { describe, expect, it } from 'vitest';
import { aggregateDatasetValues, profileDatasetColumns } from '../csv';

describe('dataset column profiles', () => {
  it('recognizes time, measure, geography, and categories', () => {
    const profiles = profileDatasetColumns({
      columns: ['Jahr', 'Bundesland', 'Wert', 'Kategorie'],
      rows: [
        { Jahr: '2024', Bundesland: 'Berlin', Wert: '10,5', Kategorie: 'A' },
        { Jahr: '2025', Bundesland: 'Hamburg', Wert: '12,5', Kategorie: 'B' },
      ],
    });

    expect(profiles.find(profile => profile.name === 'Jahr')).toMatchObject({
      type: 'date',
      role: 'time',
    });
    expect(profiles.find(profile => profile.name === 'Bundesland')).toMatchObject({
      role: 'geo',
    });
    expect(profiles.find(profile => profile.name === 'Wert')).toMatchObject({
      type: 'number',
      role: 'measure',
    });
  });

  it('calculates all supported descriptive aggregations', () => {
    expect(aggregateDatasetValues([1, 2, 3], 'sum')).toBe(6);
    expect(aggregateDatasetValues([1, 2, 3], 'mean')).toBe(2);
    expect(aggregateDatasetValues([1, 2, 8, 9], 'median')).toBe(5);
    expect(aggregateDatasetValues([1, 2, 3], 'count')).toBe(3);
  });
});
