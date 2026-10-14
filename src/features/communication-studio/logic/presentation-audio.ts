/** Local, allowlisted audio shared by documents, the server and audience players. */
export const presentationBuiltinIds = [
  'test-tone',
  'cinematic-thriller',
  'cinematic-atmosphere',
  'cinematic-hope',
  'cinematic-sequence',
] as const;

export type PresentationBuiltinId = (typeof presentationBuiltinIds)[number];

export const presentationTestTone = {
  id: 'test-tone',
  url: '/audio/presentation-test-tone.wav',
  duration: 3,
} as const;

const license = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' } as const;
export const presentationMusic = [
  {
    id: 'cinematic-thriller',
    url: '/audio/cinematic/the-complex.mp3',
    duration: 267.692313,
    title: 'The Complex',
    mood: 'thriller',
    author: 'Kevin MacLeod',
    source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300025',
    license,
  },
  {
    id: 'cinematic-atmosphere',
    url: '/audio/cinematic/impact-prelude.mp3',
    duration: 202.912086,
    title: 'Impact Prelude',
    mood: 'atmosphere',
    author: 'Kevin MacLeod',
    source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100617',
    license,
  },
  {
    id: 'cinematic-hope',
    url: '/audio/cinematic/eternal-hope.mp3',
    duration: 284,
    title: 'Eternal Hope',
    mood: 'hope',
    author: 'Kevin MacLeod',
    source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100238',
    license,
  },
] as const;

export const presentationSequence = {
  id: 'cinematic-sequence',
  tracks: [presentationMusic[1], presentationMusic[0], presentationMusic[2]],
  crossfade: 3,
  duration: presentationMusic.reduce((sum, track) => sum + track.duration, 0) - 6,
  cycleDuration: presentationMusic.reduce((sum, track) => sum + track.duration, 0) - 9,
} as const;

/** The next boundary at which a non-repeating current sequence finishes. */
export function presentationSequenceEnd(position: number) {
  return (
    Math.floor(Math.max(0, position) / presentationSequence.cycleDuration) *
      presentationSequence.cycleDuration +
    presentationSequence.duration
  );
}

/** Absolute positions retain the first pass and the last/first overlap across days. */
export function presentationSequenceVoices(position: number, loop: boolean, endPosition?: number) {
  const { tracks, crossfade, cycleDuration, duration } = presentationSequence;
  const time = Math.max(0, position);
  const end = loop ? Infinity : (endPosition ?? duration);
  if (time >= end) return [];
  const cycle = Math.floor(time / cycleDuration);
  const voices: { track: (typeof tracks)[number]; position: number; gain: number; key: string }[] =
    [];
  for (const pass of [cycle - 1, cycle]) {
    if (pass < 0) continue;
    let start = pass * cycleDuration;
    for (const [index, track] of tracks.entries()) {
      const local = time - start;
      if (start < end - crossfade - 0.000001 && local >= 0 && local < track.duration) {
        const entering = pass > 0 || index > 0 ? Math.min(1, local / crossfade) : 1;
        const hasNext = index < tracks.length - 1 || start + track.duration < end - 0.000001;
        const leaving = hasNext ? Math.min(1, (track.duration - local) / crossfade) : 1;
        voices.push({
          track,
          position: local,
          gain: Math.max(0, Math.min(entering, leaving)),
          key: `${pass}:${track.id}`,
        });
      }
      start += track.duration - crossfade;
    }
  }
  return voices;
}

export function getPresentationMusicCredits(id: string | undefined) {
  return id === presentationSequence.id
    ? [...presentationSequence.tracks]
    : presentationMusic.filter(track => track.id === id);
}
export function getPresentationMusic(id: string | undefined) {
  return presentationMusic.find(track => track.id === id);
}
export function getPresentationBuiltin(id: string | undefined) {
  return id === presentationSequence.id
    ? presentationSequence
    : id === presentationTestTone.id
      ? presentationTestTone
      : getPresentationMusic(id);
}
export function parsePresentationBuiltinSelection(
  value: string
): PresentationBuiltinId | undefined {
  if (!value.startsWith('builtin:')) return undefined;
  const id = value.slice('builtin:'.length);
  return presentationBuiltinIds.find(allowed => allowed === id);
}

/** Keep shared loop positions bounded, even after days without a control command. */
export function normalizePresentationAudioPosition(
  audio: { builtin?: string; loop?: boolean },
  position: number
) {
  const source = getPresentationBuiltin(audio.builtin);
  const positive = Math.max(0, position);
  if (!source || source.id === presentationSequence.id) return positive;
  return audio.loop && source.id !== 'test-tone'
    ? positive % source.duration
    : Math.min(positive, source.duration);
}

export function presentationMusicCredits() {
  return presentationMusic
    .map(
      track =>
        `"${track.title}" — ${track.author} (incompetech.com)\nSource: ${track.source}\nLicensed under Creative Commons: By Attribution 4.0 License\n${track.license.url}\nOriginal recording; playback may include fades and repetition.`
    )
    .join('\n\n');
}
