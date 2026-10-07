import { describe, expect, it } from 'vitest';
import { MAX_STATE_BYTES, stableJson, textValue } from '../document-value';
describe('Durable document values', () => {
  it('canonicalizes nested objects by key while retaining array order and omitting undefined object properties', () => {
    expect(stableJson({ z: [3, null, { b: true, a: 'text' }], a: undefined, m: 2 })).toBe(
      '{"m":2,"z":[3,null,{"a":"text","b":true}]}'
    );
    expect(stableJson({ b: 2, a: 1 })).toBe(stableJson({ a: 1, b: 2 }));
    expect(stableJson(undefined)).toBe('null');
    expect(stableJson([undefined, 'a'])).toBe('[null,"a"]');
    expect(MAX_STATE_BYTES).toBe(12_000_000);
  });
  it.each([null, undefined, []])(
    'creates an empty paragraph for absent document value %j',
    value => {
      expect(textValue(value)).toEqual([{ type: 'p', children: [{ text: '' }] }]);
    }
  );
  it('accepts plain text and validated nested editor nodes without changing durable properties', () => {
    expect(textValue('Literal <script>')).toEqual([
      { type: 'p', children: [{ text: 'Literal <script>' }] },
    ]);
    const value = [
      {
        type: 'p',
        id: 'paragraph',
        children: [
          { type: 'a', url: 'https://example.com', children: [{ text: 'linked', bold: true }] },
        ],
      },
    ];
    expect(textValue(value)).toBe(value);
  });
  it.each([
    false,
    1,
    {},
    [null],
    [false],
    [[]],
    [{}],
    [{ children: 'invalid' }],
    [{ children: [null] }],
  ])('rejects malformed editor value %j', value => {
    expect(() => textValue(value)).toThrow('invalid_text');
  });
  it('rejects excessive nesting and node counts before they enter durable editor state', () => {
    let deep: unknown = { text: 'leaf' };
    for (let depth = 0; depth < 66; depth++) deep = { children: [deep] };
    expect(() => textValue([deep])).toThrow('invalid_text');
    expect(() => textValue(Array.from({ length: 100_001 }, () => ({ text: '' })))).toThrow(
      'invalid_text'
    );
  });
});
