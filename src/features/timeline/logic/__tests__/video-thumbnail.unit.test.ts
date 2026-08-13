import { describe, expect, it } from 'vitest';

import {
  formatVideoDuration,
  getDailymotionThumbnail,
  getVideoEmbedUrl,
  getVideoMetadata,
  getVimeoThumbnailUrl,
  getYouTubeThumbnail,
  isDirectVideoUrl,
  isVideoUrl,
  parseVideoUrl,
} from '../video-thumbnail';

describe('parseVideoUrl', () => {
  it.each([
    ['https://youtube.com/watch?v=abcdefghijk', 'abcdefghijk'],
    ['https://youtube.com/embed/ABCDEFGHIJK', 'ABCDEFGHIJK'],
    ['https://youtube.com/v/a_b-cD12345', 'a_b-cD12345'],
    ['https://youtu.be/12345678901', '12345678901'],
    ['https://youtube.com/shorts/shorts_ID01', 'shorts_ID01'],
  ])('recognizes YouTube URL %s', (url, videoId) => {
    expect(parseVideoUrl(url)).toEqual({ provider: 'youtube', videoId });
  });

  it.each([
    ['https://vimeo.com/123456', '123456'],
    ['https://vimeo.com/video/987654', '987654'],
    ['https://player.vimeo.com/video/456789', '456789'],
  ])('recognizes Vimeo URL %s', (url, videoId) => {
    expect(parseVideoUrl(url)).toEqual({ provider: 'vimeo', videoId });
  });

  it.each([
    ['https://dailymotion.com/video/x8abc1', 'x8abc1'],
    ['https://dai.ly/x9def2', 'x9def2'],
  ])('recognizes Dailymotion URL %s', (url, videoId) => {
    expect(parseVideoUrl(url)).toEqual({ provider: 'dailymotion', videoId });
  });

  it.each([
    ['https://wistia.com/medias/abc123', 'abc123'],
    ['https://fast.wistia.net/embed/iframe/def456', 'def456'],
  ])('recognizes Wistia URL %s', (url, videoId) => {
    expect(parseVideoUrl(url)).toEqual({ provider: 'wistia', videoId });
  });

  it('distinguishes direct video files from unknown URLs', () => {
    expect(parseVideoUrl('https://cdn.test/movie.MP4?download=1')).toEqual({ provider: 'direct' });
    expect(parseVideoUrl('https://example.test/article')).toEqual({ provider: 'unknown' });
  });
});

describe('video URL output helpers', () => {
  it.each(['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'])(
    'recognizes the direct extension %s',
    extension => {
      expect(isDirectVideoUrl(`https://cdn.test/video${extension}`)).toBe(true);
    }
  );

  it('rejects non-video file extensions', () => {
    expect(isDirectVideoUrl('https://cdn.test/image.jpg')).toBe(false);
  });

  it('builds every thumbnail quality and provider URL', () => {
    expect(getYouTubeThumbnail('abcdefghijk', 'default')).toBe(
      'https://img.youtube.com/vi/abcdefghijk/default.jpg'
    );
    expect(getYouTubeThumbnail('abcdefghijk', 'medium')).toContain('/mqdefault.jpg');
    expect(getYouTubeThumbnail('abcdefghijk')).toContain('/hqdefault.jpg');
    expect(getYouTubeThumbnail('abcdefghijk', 'maxres')).toContain('/maxresdefault.jpg');
    expect(getVimeoThumbnailUrl('123')).toBe('https://vumbnail.com/123.jpg');
    expect(getDailymotionThumbnail('x1')).toBe('https://www.dailymotion.com/thumbnail/video/x1');
  });

  it.each([
    ['https://youtu.be/abcdefghijk', 'https://www.youtube.com/embed/abcdefghijk'],
    ['https://vimeo.com/123', 'https://player.vimeo.com/video/123'],
    ['https://dai.ly/x1', 'https://www.dailymotion.com/embed/video/x1'],
    ['https://wistia.com/medias/a1', 'https://fast.wistia.net/embed/iframe/a1'],
    ['https://cdn.test/video.mp4', 'https://cdn.test/video.mp4'],
    ['https://example.test/article', null],
  ])('builds the embed URL for %s', (url, expected) => {
    expect(getVideoEmbedUrl(url)).toBe(expected);
  });

  it.each([
    [
      'https://youtu.be/abcdefghijk',
      'youtube',
      'abcdefghijk',
      'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
    ],
    ['https://vimeo.com/123', 'vimeo', '123', 'https://vumbnail.com/123.jpg'],
    ['https://dai.ly/x1', 'dailymotion', 'x1', 'https://www.dailymotion.com/thumbnail/video/x1'],
    ['https://wistia.com/medias/a1', 'wistia', 'a1', ''],
    ['https://cdn.test/video.webm', 'direct', undefined, ''],
    ['https://example.test/article', 'unknown', undefined, ''],
  ])('derives metadata for %s', (url, provider, videoId, thumbnailUrl) => {
    expect(getVideoMetadata(url)).toEqual({ provider, videoId, thumbnailUrl });
  });

  it('classifies recognized provider and direct URLs as video URLs', () => {
    expect(isVideoUrl('https://youtu.be/abcdefghijk')).toBe(true);
    expect(isVideoUrl('https://cdn.test/video.mov')).toBe(true);
    expect(isVideoUrl('https://example.test/article')).toBe(false);
  });
});

describe('formatVideoDuration', () => {
  it('formats sub-hour and hour durations with flooring and padding', () => {
    expect(formatVideoDuration(0)).toBe('0:00');
    expect(formatVideoDuration(65.9)).toBe('1:05');
    expect(formatVideoDuration(3661.8)).toBe('1:01:01');
    expect(formatVideoDuration(36_005)).toBe('10:00:05');
  });
});
