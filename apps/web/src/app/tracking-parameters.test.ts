import { describe, expect, it } from 'vitest';
import { withoutTrackingParameters } from './tracking-parameters';

describe('withoutTrackingParameters', () => {
  it('drops what Facebook and campaigns append, and keeps the app’s own parameters', () => {
    const query = { fbclid: 'IwY2xjawUl0rh', utm_source: 'newsletter', tab: 'borrowed' };

    expect(withoutTrackingParameters(query)).toEqual({ tab: 'borrowed' });
  });

  it('says there is nothing to drop from a clean address', () => {
    expect(withoutTrackingParameters({ redirect: '/friends' })).toBeNull();
    expect(withoutTrackingParameters({})).toBeNull();
  });
});
