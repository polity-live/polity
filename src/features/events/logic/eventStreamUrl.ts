export type EventStreamSource =
  | {
      provider: 'youtube' | 'twitch';
      embedUrl: string;
      externalUrl: string;
    }
  | {
      provider: 'external';
      externalUrl: string;
    };

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const TWITCH_CHANNEL = /^[A-Za-z0-9_]{1,25}$/;
const TWITCH_VIDEO_ID = /^\d+$/;
const TWITCH_CLIP_SLUG = /^[A-Za-z0-9_-]+$/;
const TWITCH_RESERVED_PATHS = new Set([
  'directory',
  'downloads',
  'jobs',
  'p',
  'settings',
  'subscriptions',
  'videos',
  'wallet',
]);

function isHttpProtocol(protocol: string) {
  return protocol === 'http:' || protocol === 'https:';
}

export function normalizeEventStreamUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (!isHttpProtocol(url.protocol) || !url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function isValidOptionalEventStreamUrl(value: string): boolean {
  return value.trim().length === 0 || normalizeEventStreamUrl(value) !== null;
}

function getYouTubeVideoId(url: URL): string | null {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId: string | null = null;

  if (hostname === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (
    hostname === 'youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'youtube-nocookie.com'
  ) {
    const segments = url.pathname.split('/').filter(Boolean);
    if (url.pathname === '/watch') videoId = url.searchParams.get('v');
    if (segments[0] === 'live' || segments[0] === 'embed') videoId = segments[1] ?? null;
  }

  return videoId && YOUTUBE_VIDEO_ID.test(videoId) ? videoId : null;
}

function resolveTwitchEmbed(url: URL, parentHostname: string): string | null {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);
  const parent = parentHostname.trim().toLowerCase();
  if (!parent) return null;

  if (hostname === 'clips.twitch.tv') {
    const clip = segments[0];
    if (!clip || !TWITCH_CLIP_SLUG.test(clip)) return null;
    const embed = new URL('https://clips.twitch.tv/embed');
    embed.searchParams.set('clip', clip);
    embed.searchParams.set('parent', parent);
    embed.searchParams.set('autoplay', 'false');
    return embed.href;
  }

  if (hostname !== 'twitch.tv' && hostname !== 'm.twitch.tv') return null;

  if (segments[1] === 'clip' && segments[2] && TWITCH_CLIP_SLUG.test(segments[2])) {
    const embed = new URL('https://clips.twitch.tv/embed');
    embed.searchParams.set('clip', segments[2]);
    embed.searchParams.set('parent', parent);
    embed.searchParams.set('autoplay', 'false');
    return embed.href;
  }

  if (segments[0] === 'clip' && segments[1] && TWITCH_CLIP_SLUG.test(segments[1])) {
    const embed = new URL('https://clips.twitch.tv/embed');
    embed.searchParams.set('clip', segments[1]);
    embed.searchParams.set('parent', parent);
    embed.searchParams.set('autoplay', 'false');
    return embed.href;
  }

  const embed = new URL('https://player.twitch.tv/');
  if (segments[0] === 'videos' && segments[1] && TWITCH_VIDEO_ID.test(segments[1])) {
    embed.searchParams.set('video', `v${segments[1]}`);
  } else if (
    segments[0] &&
    TWITCH_CHANNEL.test(segments[0]) &&
    !TWITCH_RESERVED_PATHS.has(segments[0].toLowerCase())
  ) {
    embed.searchParams.set('channel', segments[0]);
  } else {
    return null;
  }
  embed.searchParams.set('parent', parent);
  embed.searchParams.set('autoplay', 'false');
  return embed.href;
}

export function resolveEventStreamSource(
  value: string | null | undefined,
  parentHostname = ''
): EventStreamSource | null {
  const externalUrl = normalizeEventStreamUrl(value);
  if (!externalUrl) return null;

  const url = new URL(externalUrl);
  const youtubeVideoId = getYouTubeVideoId(url);
  if (youtubeVideoId) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(youtubeVideoId)}?autoplay=0&rel=0&modestbranding=1`,
      externalUrl,
    };
  }

  const twitchEmbedUrl = resolveTwitchEmbed(url, parentHostname);
  if (twitchEmbedUrl) {
    return { provider: 'twitch', embedUrl: twitchEmbedUrl, externalUrl };
  }

  return { provider: 'external', externalUrl };
}
