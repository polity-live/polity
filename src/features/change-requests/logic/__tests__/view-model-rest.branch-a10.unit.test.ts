import { expect, it } from 'vitest';

import { mapChangeRequestsToDiffMap } from '../changeRequestsViewModel';

it('treats missing legacy suggestion property maps as empty', () => {
  expect(
    mapChangeRequestsToDiffMap([
      {
        id: 'cr-1',
        type: 'block-properties',
        text: '',
        newText: '',
        properties: undefined,
        newProperties: undefined,
      } as never,
    ])
  ).toEqual({});
});
