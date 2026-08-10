import { describe, expect, it, vi } from 'vitest';

import plugin from '../polity-plugin.mjs';

function openingElement(name: string, attributes: string[]) {
  return {
    name: { type: 'JSXIdentifier', name },
    attributes: attributes.map(attribute => ({
      type: 'JSXAttribute',
      name: { type: 'JSXIdentifier', name: attribute },
    })),
  };
}

describe('Polity lint plugin', () => {
  it('reports native title tooltips on interactive elements only', () => {
    const report = vi.fn();
    const rule = plugin.rules['no-native-title-tooltip'];
    const visitor = rule.create({ report });

    visitor.JSXOpeningElement(openingElement('button', ['title']));
    visitor.JSXOpeningElement(openingElement('a', ['href', 'title']));
    visitor.JSXOpeningElement(openingElement('button', ['aria-label']));
    visitor.JSXOpeningElement(openingElement('div', ['title']));
    visitor.JSXOpeningElement({
      name: { type: 'JSXMemberExpression' },
      attributes: [],
    });

    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'forbidden' }));
    expect(plugin.meta.name).toBe('polity');
  });
});
