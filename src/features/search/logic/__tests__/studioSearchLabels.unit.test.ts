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

it('preserves custom Studio kinds and leaves a missing kind unlabeled', () => {
  expect(
    studioSearchKindLabel({ entity_type: 'studio', subtitle: 'Custom imported layout' }, key => key)
  ).toBe('Custom imported layout');
  expect(studioSearchKindLabel({ entity_type: 'studio', subtitle: null }, key => key)).toBeNull();
});
