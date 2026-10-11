import { translate } from '@/features/shared/hooks/use-translation';
import { presentationMusic } from '../logic/presentation-audio';

/** The same local catalog and grouping in the director and Studio cue menus. */
export function PresentationAudioOptions({
  assets,
}: {
  assets: { id: string; name: string; mime: string }[];
}) {
  return (
    <>
      <optgroup label={translate('features.studio.eventLive.builtinMusic')}>
        <option value="builtin:cinematic-sequence">
          {translate('features.studio.eventLive.cinematicSequence')}
        </option>
        {presentationMusic.map(track => (
          <option key={track.id} value={`builtin:${track.id}`}>
            {track.title} · {translate(`features.studio.eventLive.musicMoods.${track.mood}`)}
          </option>
        ))}
      </optgroup>
      <optgroup label={translate('features.studio.eventLive.uploadedMusic')}>
        {assets
          .filter(asset => asset.mime.startsWith('audio/'))
          .map(asset => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
      </optgroup>
      <optgroup label={translate('features.studio.eventLive.testSound')}>
        <option value="builtin:test-tone">{translate('features.studio.eventLive.testTone')}</option>
      </optgroup>
    </>
  );
}
