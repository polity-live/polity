import { describe, expect, it } from 'vitest';

import { matchInviteCsvUsers } from '../groupInviteCsv';

describe('matchInviteCsvUsers', () => {
  const users = [
    { id: '1', first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' },
    { id: '2', first_name: 'Grace', last_name: 'Hopper', handle: 'grace' },
    { id: '3', first_name: 'Alex', last_name: 'Kim', handle: 'alex-kim-1' },
    { id: '4', first_name: 'Alex', last_name: 'Kim', handle: 'alex-kim-2' },
  ];

  it('matches unique full names and reports missing users', () => {
    const csv = ['first name,last name', 'Ada,Lovelace', 'Unknown,Person'].join('\n');

    const result = matchInviteCsvUsers(csv, users);

    expect(result.missingColumns).toBe(false);
    expect(result.matchedUsers).toEqual([{ id: '1', name: 'Ada Lovelace' }]);
    expect(result.notFoundNames).toEqual(['Unknown Person']);
    expect(result.ambiguousNames).toEqual([]);
  });

  it('marks duplicate name matches as ambiguous instead of inviting both', () => {
    const csv = ['first name,last name', 'Alex,Kim'].join('\n');

    const result = matchInviteCsvUsers(csv, users);

    expect(result.matchedUsers).toEqual([]);
    expect(result.notFoundNames).toEqual([]);
    expect(result.ambiguousNames).toHaveLength(1);
    expect(result.ambiguousNames[0]).toEqual({
      fullName: 'Alex Kim',
      candidates: [
        { id: '3', name: 'Alex Kim' },
        { id: '4', name: 'Alex Kim' },
      ],
    });
  });

  it('accepts german-style headers and skips incomplete rows', () => {
    const csv = ['Vorname,Nachname', 'Grace,Hopper', 'Ada,', 'Lovelace'].join('\n');

    const result = matchInviteCsvUsers(csv, users);

    expect(result.missingColumns).toBe(false);
    expect(result.matchedUsers).toEqual([{ id: '2', name: 'Grace Hopper' }]);
    expect(result.invalidRows).toEqual(['Row 3: Ada,', 'Row 4: Lovelace']);
  });

  it('rejects rows missing either indexed value when the shorter column comes first', () => {
    const result = matchInviteCsvUsers('last name,first name\nLovelace', users);

    expect(result.invalidRows).toEqual(['Row 2: Lovelace']);
  });

  it('reports missing required columns', () => {
    const csv = ['email,name', 'ada@example.com,Ada Lovelace'].join('\n');

    const result = matchInviteCsvUsers(csv, users);

    expect(result.missingColumns).toBe(true);
    expect(result.totalRows).toBe(0);
    expect(result.matchedUsers).toEqual([]);
  });

  it('reports empty input and each independently missing column', () => {
    expect(matchInviteCsvUsers('  \n', users).missingColumns).toBe(true);
    expect(matchInviteCsvUsers('first name,email\nAda,a@example.com', users).missingColumns).toBe(
      true
    );
    expect(
      matchInviteCsvUsers('email,last name\na@example.com,Lovelace', users).missingColumns
    ).toBe(true);
  });

  it.each([['firstname,lastname'], ['first_name,last_name']])(
    'accepts compact header variant %s',
    header => {
      expect(matchInviteCsvUsers(`${header}\nAda,Lovelace`, users).matchedUsers[0].id).toBe('1');
    }
  );

  it('parses quoted commas and escaped quotes', () => {
    const quotedUsers = [
      { id: 'quoted', first_name: 'Ada, Countess', last_name: 'Lovelace' },
      { id: 'quote', first_name: 'Ada "Ace"', last_name: 'Byron' },
    ];
    const csv = ['first name,last name', '"Ada, Countess",Lovelace', '"Ada ""Ace""",Byron'].join(
      '\n'
    );
    expect(matchInviteCsvUsers(csv, quotedUsers).matchedUsers.map(user => user.id)).toEqual([
      'quoted',
      'quote',
    ]);
  });

  it('normalizes accents, excludes users, ignores unnamed users, and deduplicates rows', () => {
    const extendedUsers = [
      { id: 'accent', first_name: 'Éva', last_name: 'Müller' },
      { id: 'empty', first_name: null, last_name: null },
    ];
    const csv = ['first name,last name', 'Eva,Muller', 'Eva,Muller'].join('\n');
    expect(matchInviteCsvUsers(csv, extendedUsers).matchedUsers).toEqual([
      { id: 'accent', name: 'Éva Müller' },
    ]);
    expect(
      matchInviteCsvUsers(csv, extendedUsers, { excludeUserId: 'accent' }).notFoundNames
    ).toEqual(['Eva Muller']);
  });

  it('uses the canonical matched full name for display', () => {
    const fallbackUsers = [
      { id: 'handle-id', first_name: 'A', last_name: 'One', handle: 'handle' },
      { id: 'email-id', first_name: 'B', last_name: 'Two', email: 'b@example.com' },
      { id: 'id-only', first_name: 'C', last_name: 'Three' },
    ];
    const result = matchInviteCsvUsers(
      ['first name,last name', 'A,One', 'B,Two', 'C,Three'].join('\n'),
      fallbackUsers
    );
    expect(result.matchedUsers.map(user => user.name)).toEqual(['A One', 'B Two', 'C Three']);
  });
});
