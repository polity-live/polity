import { describe, expect, it } from 'vitest';
import { parseActiveMentionQuery, parseActiveToolCommand } from '../logic/assistantComposer';

describe('parseActiveMentionQuery', () => {
  it('keeps the first @ as the active entity trigger for typed entity searches', () => {
    expect(parseActiveMentionQuery('@group@Test', '@group@Test'.length)).toEqual({
      start: 0,
      end: '@group@Test'.length,
      raw: '@group@Test',
      entityType: 'group',
      searchText: 'test',
    });
  });

  it('supports entity queries after whitespace', () => {
    expect(
      parseActiveMentionQuery('Please check @event@Town', 'Please check @event@Town'.length)
    ).toEqual({
      start: 'Please check '.length,
      end: 'Please check @event@Town'.length,
      raw: '@event@Town',
      entityType: 'event',
      searchText: 'town',
    });
  });

  it('ignores @ characters in the middle of words', () => {
    expect(parseActiveMentionQuery('email@group@Test', 'email@group@Test'.length)).toBeNull();
  });
});

describe('parseActiveToolCommand', () => {
  it('parses a trailing tool token after whitespace', () => {
    expect(parseActiveToolCommand('Use #create_event', 'Use #create_event'.length)).toEqual({
      start: 'Use '.length,
      end: 'Use #create_event'.length,
      raw: '#create_event',
      searchText: 'create_event',
    });
  });

  it('ignores # characters in the middle of words', () => {
    expect(parseActiveToolCommand('abc#create_event', 'abc#create_event'.length)).toBeNull();
  });
});
