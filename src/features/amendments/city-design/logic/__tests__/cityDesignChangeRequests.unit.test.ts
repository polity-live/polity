import { describe, expect, it } from 'vitest';
import { isOpenCityDesignChangeRequest } from '../cityDesignChangeRequests';

describe('isOpenCityDesignChangeRequest', () => {
  it('keeps open city design change requests visible', () => {
    expect(isOpenCityDesignChangeRequest({ status: 'open', voting_status: 'open' })).toBe(true);
    expect(isOpenCityDesignChangeRequest({ status: null, voting_status: null })).toBe(true);
  });

  it.each(['accepted', 'rejected', 'approved', 'declined', 'closed', 'resolved'])(
    'hides %s change requests',
    status => {
      expect(isOpenCityDesignChangeRequest({ status, voting_status: 'open' })).toBe(false);
    }
  );

  it('hides completed voting change requests', () => {
    expect(isOpenCityDesignChangeRequest({ status: 'open', voting_status: 'completed' })).toBe(
      false
    );
  });
});
