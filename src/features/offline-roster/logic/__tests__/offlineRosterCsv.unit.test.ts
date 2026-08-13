import { describe, expect, it } from 'vitest';

import { normalizeDraftKey, parseCsvLine, parseOfflineRosterCsv } from '../offlineRosterCsv';

describe('offline roster CSV helpers', () => {
  it('parses quoted CSV values and trims outer quotes', () => {
    expect(parseCsvLine('"Ada","Lovelace","Needs ""paper"" ballot"')).toEqual([
      'Ada',
      'Lovelace',
      'Needs "paper" ballot',
    ]);
  });

  it('skips duplicate and incomplete roster rows', () => {
    const existingKeys = new Set([
      normalizeDraftKey({
        firstName: 'Ada',
        lastName: 'Lovelace',
        reasonNotSignedUp: 'No account',
      }),
    ]);

    const result = parseOfflineRosterCsv(
      [
        'firstName,lastName,reasonNotSignedUp',
        'Ada,Lovelace,No account',
        'Grace,Hopper,Offline participant',
        'MissingLast,,Incomplete',
      ].join('\n'),
      existingKeys
    );

    expect(result.rows).toEqual([
      {
        firstName: 'Grace',
        lastName: 'Hopper',
        reasonNotSignedUp: 'Offline participant',
      },
    ]);
    expect(result.skippedDuplicates).toBe(1);
    expect(result.skippedMissingNames).toBe(1);
  });

  it('recognizes every supported header spelling and accepts headerless rows', () => {
    expect(parseOfflineRosterCsv('   \n', new Set())).toEqual({
      rows: [],
      skippedDuplicates: 0,
      skippedMissingNames: 0,
    });

    for (const header of [
      'first_name,surname,reason',
      'given,lastname,reason',
      'given,last_name,reason',
    ]) {
      expect(parseOfflineRosterCsv(`${header}\nAda,Lovelace,Offline`, new Set()).rows).toEqual([
        { firstName: 'Ada', lastName: 'Lovelace', reasonNotSignedUp: 'Offline' },
      ]);
    }

    expect(parseOfflineRosterCsv('Ada,Lovelace,Offline', new Set()).rows).toEqual([
      { firstName: 'Ada', lastName: 'Lovelace', reasonNotSignedUp: 'Offline' },
    ]);
  });
});
