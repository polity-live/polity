import { describe, expect, it } from 'vitest';

import { getRequiredEnvVar } from '../env';

describe('getRequiredEnvVar', () => {
  it('returns configured values', () => {
    expect(getRequiredEnvVar('configured', 'VALUE')).toBe('configured');
  });

  it('rejects missing and empty values with the variable name', () => {
    expect(() => getRequiredEnvVar(undefined, 'VALUE')).toThrow('VALUE is not defined');
    expect(() => getRequiredEnvVar('', 'EMPTY')).toThrow('EMPTY is not defined');
  });
});
