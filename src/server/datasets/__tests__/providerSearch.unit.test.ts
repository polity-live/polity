import { describe, expect, it } from 'vitest';
import { getDatasetSearchQueries } from '../providers';

describe('dataset search query expansion', () => {
  it.each(['Bruttoinlandsprodukt Deutschland', 'GDP Germany'])(
    'maps %s to German and English GDP concepts',
    query => {
      const queries = getDatasetSearchQueries(query);
      expect(queries).toContain('Bruttoinlandsprodukt');
      expect(queries).toContain('gross domestic product');
      expect(queries.length).toBeLessThanOrEqual(3);
      expect(queries.every(value => !/Deutschland|Germany/.test(value))).toBe(true);
    }
  );
  it('distinguishes national product from domestic product', () => {
    const queries = getDatasetSearchQueries('Gross national product Germany');
    expect(queries).toContain('Bruttonationalprodukt');
    expect(queries).not.toContain('Bruttoinlandsprodukt');
    expect(queries.length).toBeLessThanOrEqual(3);
  });
});
