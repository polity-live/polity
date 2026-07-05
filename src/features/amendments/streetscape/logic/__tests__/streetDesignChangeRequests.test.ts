import { describe, expect, it } from 'vitest';
import { isOpenStreetDesignChangeRequest } from '../streetDesignChangeRequests';

describe('isOpenStreetDesignChangeRequest', () => {
  it('keeps open street design change requests visible', () => {
    expect(isOpenStreetDesignChangeRequest({ status: 'open', voting_status: 'open' })).toBe(true);
    expect(isOpenStreetDesignChangeRequest({ status: null, voting_status: null })).toBe(true);
  });

  it.each(['accepted', 'rejected', 'approved', 'declined', 'closed', 'resolved'])(
    'hides %s change requests',
    status => {
      expect(isOpenStreetDesignChangeRequest({ status, voting_status: 'open' })).toBe(false);
    }
  );

  it('hides completed voting change requests', () => {
    expect(isOpenStreetDesignChangeRequest({ status: 'open', voting_status: 'completed' })).toBe(
      false
    );
  });
});
