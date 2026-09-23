import { expect, it } from 'vitest';
import { studioSearchKindLabel } from '../studioSearchLabels';

it('translates the kind of a Studio search result', () => {
  expect(
    studioSearchKindLabel({ entity_type: 'studio', subtitle: 'single' }, key =>
      key === 'features.studio.single' ? 'Einzelpost' : key
    )
  ).toBe('Einzelpost');
});

it('preserves subtitles of other search result types', () => {
  expect(studioSearchKindLabel({ entity_type: 'blog', subtitle: 'single' }, key => key)).toBeNull();
});
