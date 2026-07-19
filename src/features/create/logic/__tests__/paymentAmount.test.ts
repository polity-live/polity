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

  it('enforces the original currency precision', () => {
    expect(parseCreatePaymentAmount('12.3', 'JPY')).toBeNull();
    expect(parseCreatePaymentAmount('12', 'JPY')).toBe(12);
    expect(parseCreatePaymentAmount('12.345', 'KWD')).toBe(12.345);
    expect(parseCreatePaymentAmount('12.3456', 'KWD')).toBeNull();
    expect(parseCreatePaymentAmount('12.3456', 'CLF')).toBe(12.3456);
  });
});
