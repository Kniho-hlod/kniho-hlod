import { describe, expect, it } from 'vitest';
import { describeFeedbackContext } from './feedback-context';

describe('describeFeedbackContext', () => {
  it('names the page, the build and the window size', () => {
    expect(
      describeFeedbackContext('/books?shelf=sh_1', 'abc1234', { innerWidth: 390, innerHeight: 844 })
    ).toEqual({ pageUrl: '/books?shelf=sh_1', appVersion: 'abc1234', viewport: '390×844' });
  });
});
