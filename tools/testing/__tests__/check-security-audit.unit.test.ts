import { describe, expect, it } from 'vitest';

import { auditRegressions, vulnerabilityMap } from '../check-security-audit.mjs';

describe('runtime dependency security ratchet', () => {
  it('normalizes npm audit findings', () => {
    expect(
      vulnerabilityMap({
        vulnerabilities: {
          zeta: { severity: 'high' },
          alpha: { severity: 'low' },
        },
      })
    ).toEqual({ alpha: 'low', zeta: 'high' });
  });

  it('allows resolved or reduced findings', () => {
    expect(
      auditRegressions({ existing: 'moderate' }, { existing: 'high', resolved: 'high' })
    ).toEqual([]);
  });

  it('rejects new, increased and critical findings', () => {
    expect(
      auditRegressions(
        { criticalPackage: 'critical', existing: 'high', introduced: 'low' },
        { criticalPackage: 'high', existing: 'moderate' }
      )
    ).toEqual([
      'criticalPackage: critical vulnerability',
      'criticalPackage: severity increased from high to critical',
      'existing: severity increased from moderate to high',
      'introduced: new low vulnerability',
    ]);
  });
});
