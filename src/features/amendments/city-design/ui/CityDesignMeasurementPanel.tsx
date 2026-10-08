import { Ruler, MousePointer2, X } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { getCityDesignObjectDefinition } from '../logic/cityDesignObjectRegistry';
import { getCityDesignOsmFeatures } from '../logic/cityDesignOsm';
import type { CityDesignStateV1 } from '../types';
import type { CityDesignMeasurements } from './useCityDesignMeasurements';

export function CityDesignMeasurementTools({
  measurements,
}: {
  measurements: CityDesignMeasurements;
}) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`features.amendments.cityDesign.measurement.${key}`);
  return (
    <div
      className="bg-background/95 absolute top-3 right-3 z-20 flex gap-1 rounded-lg border p-1 shadow-sm"
      data-canvas-focus-occluder
    >
      <Button
        size="sm"
        variant={measurements.multiSelectActive ? 'secondary' : 'ghost'}
        data-action-id="amendments.city-measurement.toggle.multiselect"
        aria-pressed={measurements.multiSelectActive}
        onClick={() => measurements.setMultiSelectActive(!measurements.multiSelectActive)}
      >
        <MousePointer2 className="size-4" />
        {tr('multiSelect')}
      </Button>
      <Button
        size="sm"
        variant={measurements.measurementActive ? 'secondary' : 'ghost'}
        data-action-id="amendments.city-measurement.toggle.tool"
        aria-pressed={measurements.measurementActive}
        onClick={() => measurements.setMeasurementActive(!measurements.measurementActive)}
      >
        <Ruler className="size-4" />
        {tr('tool')}
      </Button>
    </div>
  );
}

export function CityDesignMeasurementPanel({
  measurements: m,
  design,
}: {
  measurements: CityDesignMeasurements;
  design: CityDesignStateV1;
}) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`features.amendments.cityDesign.measurement.${key}`);
  const meters = (value: number) => `${value.toFixed(2)} m`;
  const name = (id: string, layer: 'original' | 'design') => {
    if (layer === 'design') {
      const object = design.objects.find(item => item.id === id);
      return object ? t(getCityDesignObjectDefinition(object.type).labelKey) : id;
    }
    const feature = getCityDesignOsmFeatures(design.osmSnapshot).find(item => item.id === id);
    return (
      feature?.label ??
      (feature?.mappedObjectType
        ? t(getCityDesignObjectDefinition(feature.mappedObjectType).labelKey)
        : id)
    );
  };
  if (m.selection.length < 2 && !m.measurementActive && !m.measurement) return null;
  return (
    <section className="mb-4 space-y-3 border-b pb-4" aria-label={tr('title')}>
      {m.selectedWidths.length > 0 && m.selection.length > 1 && (
        <div className="space-y-2">
          <h3 className="font-semibold">{tr('widthSum')}</h3>
          {m.selectedWidths.map(item => (
            <div key={`${item.layer}:${item.id}`} className="flex justify-between gap-2 text-xs">
              <span>
                {name(item.id, item.layer)}
                {item.estimated ? ` · ${tr('estimated')}` : ''}
              </span>
              <span>{meters(item.width)}</span>
            </div>
          ))}
          <p className="font-semibold tabular-nums">
            {meters(m.selectedWidths.reduce((sum, item) => sum + item.width, 0))}
          </p>
          <p className="text-muted-foreground text-xs">{tr('sumDescription')}</p>
        </div>
      )}
      {(m.measurementActive || m.measurement) && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{tr('title')}</h3>
            {m.measurement && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={tr('clear')}
                data-action-id="amendments.city-measurement.clear.line"
                onClick={m.clearMeasurement}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          {design.comparisonMode === 'overlay' && (
            <label className="flex items-center justify-between gap-2 text-xs">
              {tr('layer')}
              <select
                aria-label={tr('layer')}
                value={m.measurement?.layer ?? m.measurementLayer}
                className="bg-background rounded border p-1"
                data-action-id="amendments.city-measurement.select.layer"
                onChange={event =>
                  m.setMeasurementLayer(event.target.value as 'original' | 'design')
                }
              >
                <option value="original">{tr('original')}</option>
                <option value="design">{tr('design')}</option>
              </select>
            </label>
          )}
          {m.levels.length > 1 && (
            <label className="flex items-center justify-between gap-2 text-xs">
              {tr('level')}
              <select
                aria-label={tr('level')}
                className="bg-background rounded border p-1"
                data-action-id="amendments.city-measurement.select.level"
                value={m.measurementLevel ?? m.levels[0]}
                onChange={event => m.setMeasurementLevel(event.target.value)}
              >
                {m.levels.map((level, index) => (
                  <option key={level} value={level}>
                    {tr('level')} {index + 1} · {level.split(':')[1]} m
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-muted-foreground text-xs">
            {tr(m.awaitingEnd ? 'chooseEnd' : m.measurement ? 'dragEndpoints' : 'chooseStart')}
          </p>
          {m.measurement && m.measurementResult && !m.awaitingEnd && (
            <>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums">
                <dt>{tr('span')}</dt>
                <dd>{meters(m.measurementResult.span)}</dd>
                <dt>{tr('covered')}</dt>
                <dd>{meters(m.measurementResult.covered)}</dd>
                <dt>{tr('gaps')}</dt>
                <dd>{meters(m.measurementResult.gaps)}</dd>
                <dt>{tr('overlaps')}</dt>
                <dd>{meters(m.measurementResult.overlaps)}</dd>
                <dt>{tr('lineLength')}</dt>
                <dd>{meters(m.measurementResult.length)}</dd>
              </dl>
              {m.measurementResult.sections.map((section, index) => (
                <div key={index} className="flex justify-between gap-2 text-xs">
                  <span>
                    {section.ids.length
                      ? section.ids
                          .map(id =>
                            name(id, (m.measurement as NonNullable<typeof m.measurement>).layer)
                          )
                          .join(' + ')
                      : tr('gap')}
                  </span>
                  <span className="whitespace-nowrap">{meters(section.end - section.start)}</span>
                </div>
              ))}
              {m.measurementResult.intervals.some(interval => interval.estimated) && (
                <p className="text-muted-foreground text-xs">{tr('estimatedDescription')}</p>
              )}
              {!m.measurementResult.intervals.length && (
                <p className="text-muted-foreground text-xs">{tr('noHits')}</p>
              )}
            </>
          )}
          <p className="text-muted-foreground text-xs">{tr('modelDescription')}</p>
        </>
      )}
    </section>
  );
}
