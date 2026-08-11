import { describe, expect, it } from 'vitest';

import { timelineAriaLabels } from '../accessibility';

describe('timeline accessibility label callbacks', () => {
  it('produces text from every parameterized label contract', () => {
    const outputs: string[] = [];
    const visit = (value: unknown) => {
      if (typeof value === 'function') {
        outputs.push(String(value.length >= 2 ? value('id', 'title') : value(3)));
        return;
      }
      if (value && typeof value === 'object') {
        Object.values(value).forEach(visit);
      }
    };

    visit(timelineAriaLabels);
    expect(outputs).toHaveLength(20);
    expect(outputs.every(Boolean)).toBe(true);
  });
});
