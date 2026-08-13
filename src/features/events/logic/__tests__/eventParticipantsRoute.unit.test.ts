import { describe, expect, it } from 'vitest';
import { participantsSearchSchema } from '@/routes/_authed/event/$id/participants';

describe('event participants route search schema', () => {
  it('accepts the delegate assembly composition tab', () => {
    expect(participantsSearchSchema.parse({ tab: 'composition' })).toEqual({
      tab: 'composition',
    });
  });
});
