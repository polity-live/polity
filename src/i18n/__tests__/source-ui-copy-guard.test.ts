import { describe, expect, it } from 'vitest';

import { auditRepository, auditSourceText } from '../../../tools/i18n/audit.ts';

describe('AST-based product copy audit', () => {
  it('finds visible JSX, copy props, helper returns, templates, and toast copy', () => {
    const findings = auditSourceText(`
      export function Example() {
        const item = { label: 'Object label' };
        toast.error('Something failed');
        if (item) return \`Helper sentence\`;
        return <input aria-label="Accessible name" placeholder="Find things">Visible text</input>;
      }
    `);

    expect(findings.map(finding => finding.kind).sort()).toEqual([
      'accessibility-copy',
      'accessibility-copy',
      'copy-prop',
      'helper-return',
      'jsx-text',
      'toast-copy',
    ]);
  });

  it('finds nested conditional and array copy in product-copy properties', () => {
    const findings = auditSourceText(`
      const preview = {
        entityLabel: final ? 'Final offline tally' : 'Indicative offline tally',
        badges: [\`\${count} offline selections\`, formula].filter(Boolean),
        metadata: ['Hardcoded metadata'],
        secondaryLabel: 'Hardcoded secondary label',
      };
    `);

    expect(findings.map(finding => finding.value).sort()).toEqual([
      '${…} offline selections',
      'Final offline tally',
      'Hardcoded metadata',
      'Hardcoded secondary label',
      'Indicative offline tally',
    ]);
  });

  it('allows documented technical and language-neutral values', () => {
    expect(
      auditSourceText(`
        export const Example = () => (
          <div title="https://polity.example">
            <span>Polity</span>
            <span>EUR</span>
          </div>
        );
      `)
    ).toEqual([]);
  });

  it('reports translation keys missing from either locale', () => {
    expect(
      auditSourceText(`const copy = translateText('features.example.doesNotExist');`)
    ).toMatchObject([
      {
        kind: 'missing-key',
        value: 'features.example.doesNotExist',
      },
    ]);
  });

  it('accepts translation calls backed by a complete plural pair', () => {
    expect(
      auditSourceText(
        `const copy = translateText('features.agendas.offlineTally.selectionCount', { count: 2 });`
      )
    ).toEqual([]);
  });

  it('has zero unexplained findings in production source', () => {
    expect(auditRepository()).toEqual([]);
  }, 30_000);
});
