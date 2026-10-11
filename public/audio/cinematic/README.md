# Built-in cinematic music

Original, unmodified MP3 recordings downloaded from Kevin MacLeod's official
Incompetech site on 2026-10-11. Playback uses these local files and does not
contact an external music service.

All three recordings are by **Kevin MacLeod (incompetech.com)**, licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
See the included `LICENSE-CC-BY-4.0.txt` and the author's
[licensing instructions](https://incompetech.com/music/royalty-free/licenses/).
Attribution is required, including for YouTube/OBS recordings and streams.
The audience view displays attribution; **Copy music credits** in the director
copies the source and license links for all three tracks into a video description.

Playback durations below are measured with Chromium's `HTMLAudioElement`,
which removes MP3 encoder delay and end padding.
All files are MPEG audio at 320 kbit/s. SHA-256 hashes cover the original bytes.

| ID | Recording / source | Local file | Duration (seconds) | Bytes |
| --- | --- | --- | ---: | ---: |
| `cinematic-thriller` | [The Complex](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300025) | `the-complex.mp3` | 267.692313 | 10712421 |
| `cinematic-atmosphere` | [Impact Prelude](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100617) | `impact-prelude.mp3` | 202.912086 | 8122953 |
| `cinematic-hope` | [Eternal Hope](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100238) | `eternal-hope.mp3` | 284.000000 | 11500749 |

For comparison, raw MP3 frame durations measured with Mutagen are
267.755100, 202.971425 and 284.055525 seconds respectively. The shared audio
clock uses the decoded playback durations rather than those padded values.

```text
the-complex.mp3
c270fb44a69828f6cae7412e077a38b92d55015d30ced549d0d477f864e7e41e
https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Complex.mp3

impact-prelude.mp3
8243572fc2e082252f5286692d639906799eacd1586f55866a42f60d91c4a569
https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Prelude.mp3

eternal-hope.mp3
b410a6e67dfd23868ac3a4f892226ef2d0933b7846d66f8d8472377a1fde36a5
https://incompetech.com/music/royalty-free/mp3-royaltyfree/Eternal%20Hope.mp3
```

These are complete compositions, not specially edited seamless-loop masters.
Repeating uses the original beginning and ending, including the composer's
natural fades. No trimming, remixing or re-encoding has been performed.

The built-in `cinematic-sequence` plays Impact Prelude, The Complex and Eternal
Hope in that order using these original files. Adjacent tracks overlap for three
seconds, including the last/first transition when repeating. A single pass is
748.604399 seconds (about 12½ minutes); the repeating cycle is 745.604399 seconds.
All three compositions must be credited when using the sequence. Repetition and
crossfades are performed by the player, without creating another audio file.
