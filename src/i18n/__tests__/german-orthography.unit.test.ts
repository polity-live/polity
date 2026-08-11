import { describe, expect, it } from 'vitest';

import {
  auditGermanSource,
  findAsciiGermanOrthography,
} from '../../../tools/i18n/german-orthography.ts';

describe('German orthography audit', () => {
  it('finds curated ASCII substitutions for umlauts and eszett', () => {
    expect(
      findAsciiGermanOrthography(
        'Gib eine gueltige Adresse ein, um etwas hinzufuegen und spaeter schliessen zu koennen. Das liegt ausserhalb.'
      )
    ).toEqual(['gueltige', 'hinzufuegen', 'spaeter', 'schliessen', 'koennen', 'ausserhalb']);
  });

  it('does not confuse native letter sequences with ASCII substitutions', () => {
    expect(findAsciiGermanOrthography('aktuell neue Quelle steuern Dauer Kontoerstellung')).toEqual(
      []
    );
  });

  it('skips stable translation keys and document anchors', () => {
    expect(
      auditGermanSource(`
        const key = 'generated.inline.0966_hinzufuegen_38099f83';
        const section = { id: 'naechste-schritte' };
        const label = 'Hinzufuegen';
      `)
    ).toMatchObject([
      {
        value: 'Hinzufuegen',
        words: ['Hinzufuegen'],
      },
    ]);
  });
});
