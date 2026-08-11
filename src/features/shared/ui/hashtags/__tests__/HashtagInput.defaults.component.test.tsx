/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ view: vi.fn() }));

vi.mock('../useHashtagInputController', () => ({
  useHashtagInputController: (props: any) => props,
}));
vi.mock('../HashtagInputView', () => ({
  HashtagInputView: (props: any) => {
    mocks.view(props);
    return <div />;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { HashtagInput } from '../HashtagInput';

describe('HashtagInput defaults', () => {
  it('applies all presentation defaults', () => {
    render(<HashtagInput onChange={vi.fn()} value={[]} />);
    expect(mocks.view).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Hashtags',
        placeholder: 'generated.inline.0162_add_a_hashtag_09f298a1',
        showLabel: true,
        suggestions: [],
      })
    );
  });
});
