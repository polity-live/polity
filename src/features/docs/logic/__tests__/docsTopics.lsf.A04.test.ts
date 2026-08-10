import { describe, expect, it } from 'vitest';

import {
  docsTopicDefinitions,
  docsTopicMap,
  docsTopicOrder,
  getDocsTopic,
  isDocsTopicSlug,
} from '../docsTopics';

describe('docs topic registry LSF contract', () => {
  it('materializes the ordered map and public lookup helpers', () => {
    expect(docsTopicOrder).toEqual(docsTopicDefinitions.map(topic => topic.slug));
    expect(Object.keys(docsTopicMap)).toHaveLength(docsTopicDefinitions.length);
    expect(isDocsTopicSlug('amendments')).toBe(true);
    expect(isDocsTopicSlug('not-a-topic')).toBe(false);
    expect(getDocsTopic('amendments').slug).toBe('amendments');
  });
});
