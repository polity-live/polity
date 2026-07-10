import { describe, expect, it } from 'vitest';
import { getDatasetSearchQueries } from '../providers';

describe('dataset search query expansion', () => {
  it.each(['Bruttoinlandsprodukt Deutschland', 'Gross national product Germany', 'GDP Germany'])(
    'maps %s to German and English GDP concepts',
    query => {
      const queries = getDatasetSearchQueries(query);
      expect(queries).toContain('Bruttoinlandsprodukt');
      expect(queries).toContain('gross domestic product');
      expect(queries).toContain('GDP');
    }
  );
});
