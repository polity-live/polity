import { describe, expect, it } from 'vitest';
import { parseCreatePaymentAmount } from '../paymentAmount';

describe('parseCreatePaymentAmount', () => {
  it.each([
    ['0', 0],
    ['12', 12],
    ['12.34', 12.34],
    [' 12.34 ', 12.34],
  ])('parses valid amount %s', (value, expected) => {
    expect(parseCreatePaymentAmount(value)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '12abc', '-1', 'Infinity'])(
    'returns null for invalid amount %s',
    value => {
      expect(parseCreatePaymentAmount(value)).toBeNull();
    }
  );
});
