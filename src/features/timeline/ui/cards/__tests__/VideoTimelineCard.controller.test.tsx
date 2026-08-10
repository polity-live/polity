/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../VideoTimelineCardView', () => ({
  VideoTimelineCardView: (props: Record<string, any>) => {
    mocks.viewProps = props;
    return <div />;
  },
}));

import { VideoTimelineCard, type VideoTimelineCardProps } from '../VideoTimelineCard';

const video: VideoTimelineCardProps['video'] = { id: 'video-1', title: 'Public hearing' };

function renderVideo(
  overrides: Partial<VideoTimelineCardProps['video']> = {},
  props: Partial<Omit<VideoTimelineCardProps, 'video'>> = {}
) {
  render(<VideoTimelineCard video={{ ...video, ...overrides }} {...props} />);
  return mocks.viewProps!;
}

beforeEach(() => {
  mocks.viewProps = undefined;
});
afterEach(cleanup);

describe('VideoTimelineCard controller', () => {
  it('leaves destinations empty when the video has no source', () => {
    const props = renderVideo();
    expect(props.sourceHref).toBeUndefined();
    expect(props.amendmentHref).toBeUndefined();
    expect(props.targetHref).toBeUndefined();
    expect(props.playerOpen).toBe(false);
  });

  it('uses a non-amendment source as the default destination', () => {
    const props = renderVideo({ sourceType: 'group', sourceId: 'group-1' });
    expect(props.sourceHref).toBe('/group/group-1');
    expect(props.amendmentHref).toBe('/group/group-1');
    expect(props.targetHref).toBe('/group/group-1');
  });

  it('normalizes an amendment source route', () => {
    const props = renderVideo({ sourceType: 'amendment', sourceId: 'amendment-1' });
    expect(props.sourceHref).toBe('/amendment/amendment-1');
    expect(props.amendmentHref).toBe('/amendment/amendment-1');
  });

  it('prioritizes an explicit amendment id and an explicit href', () => {
    let props = renderVideo({
      sourceType: 'group',
      sourceId: 'group-1',
      amendmentId: 'amendment-1',
    });
    expect(props.amendmentHref).toBe('/amendment/amendment-1');
    expect(props.targetHref).toBe('/amendment/amendment-1');

    cleanup();
    const onPlay = vi.fn();
    props = renderVideo({}, { href: '/custom', className: 'custom', onPlay });
    expect(props.targetHref).toBe('/custom');
    expect(props.className).toBe('custom');
    expect(props.onPlay).toBe(onPlay);
  });
});
