export interface I18nAuditAllowlistEntry {
  value: string | RegExp;
  reason: string;
}

/**
 * Deliberately small allowlist for language-neutral product copy.
 *
 * Do not add sentences, status labels, helper text, or accessibility copy here.
 * Every entry must explain why translating the value would be incorrect.
 */
export const I18N_AUDIT_VALUE_ALLOWLIST: readonly I18nAuditAllowlistEntry[] = [
  { value: 'Polity', reason: 'product name' },
  { value: 'Polity Docs', reason: 'product name' },
  { value: 'Docs', reason: 'product section name' },
  { value: 'EUR', reason: 'ISO currency code' },
  { value: 'abstain', reason: 'stable semantic vote-choice identifier' },
  { value: 'A-Z', reason: 'language-neutral compact sort notation' },
  { value: '1-9', reason: 'language-neutral compact sort notation' },
  { value: 'Frankfurter', reason: 'proper name of a subscription plan' },
  { value: 'Berlin Mitte', reason: 'real place name used by the city-design seed' },
  {
    value: /^(?:24h|[Kmvx]|0 (?:B|Byte)|\d+x\d+|< ?1 km)$/,
    reason: 'unit or compact notation',
  },
  {
    value: /^\$\{…\}h \$\{…\}m$/,
    reason: 'language-neutral compact duration units',
  },
  {
    value: /^\$\{…\} (?:B|kB|KB|MB|m|km)$/,
    reason: 'interpolated unit value',
  },
  {
    value: /^(?:(?:hsl|rgba|color-mix|translate|0 0 0 1px color-mix)\(|bg-gradient-to-br\b)/,
    reason: 'generated CSS value',
  },
  {
    value: /^(?:linear-gradient\(|--color-\$\{…\}:)/,
    reason: 'generated CSS value',
  },
  {
    value: /^(?:campaign-planner|campaign-planning)$/,
    reason: 'stable AI skill identifier',
  },
  { value: /^winner:\$\{…\}$/, reason: 'stable semantic election identifier' },
  {
    value: /^(?:\$\{…\} IN \(\$\{…\}\)|\$\{…\}(?: AND |\)).*(?:IN|IS SET))/,
    reason: 'generated PQL syntax',
  },
  { value: /^github\.com\/$/, reason: 'technical URL fragment' },
  { value: /^(?:gpt|claude)-[\w.-]+$/i, reason: 'model name' },
  {
    value: /^(?:[A-Z][A-Z ]+|field == value\b)/,
    reason: 'query-language keyword or technical syntax example',
  },
  {
    value: /^(?:common|components|features|pages|plateJs)\.[A-Za-z0-9_.-]+$/,
    reason: 'translation key transported as data',
  },
  { value: /^https?:\/\//, reason: 'URL example or technical endpoint' },
  { value: /^(?:mailto|tel):/, reason: 'technical URI' },
  { value: /^#[0-9a-f]{3,8}$/i, reason: 'CSS color value' },
] as const;

export function isAllowlistedAuditValue(value: string): boolean {
  return I18N_AUDIT_VALUE_ALLOWLIST.some(entry =>
    typeof entry.value === 'string' ? entry.value === value : entry.value.test(value)
  );
}
