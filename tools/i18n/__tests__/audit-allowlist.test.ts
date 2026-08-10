import { describe, expect, it } from 'vitest';

import { I18N_AUDIT_VALUE_ALLOWLIST, isAllowlistedAuditValue } from '../audit-allowlist';

describe('i18n audit allowlist', () => {
  it('allows only documented product names, identifiers, units, and technical syntax', () => {
    expect(isAllowlistedAuditValue('Polity')).toBe(true);
    expect(isAllowlistedAuditValue('EUR')).toBe(true);
    expect(isAllowlistedAuditValue('24h')).toBe(true);
    expect(isAllowlistedAuditValue('gpt-5.6')).toBe(true);
    expect(isAllowlistedAuditValue('https://www.polity.live')).toBe(true);
    expect(isAllowlistedAuditValue('This is untranslated product copy')).toBe(false);
    expect(I18N_AUDIT_VALUE_ALLOWLIST.every(entry => entry.reason.trim().length > 0)).toBe(true);
  });

  it('does not leak stateful regular-expression matches between calls', () => {
    expect(isAllowlistedAuditValue('#aabbcc')).toBe(true);
    expect(isAllowlistedAuditValue('#aabbcc')).toBe(true);
  });
});
