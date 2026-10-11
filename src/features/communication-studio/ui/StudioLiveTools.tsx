import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useState } from 'react';
import { ChartNoAxesCombinedIcon, Database, Music, PanelsTopLeft } from 'lucide-react';
import { useQuery } from '@/zero/observed-query';
import { queries } from '@/zero/queries';
import { politySourceTypes, type LiveBinding, type LiveSource } from '../logic/live-contract';
import { createLiveNode } from '../logic/event-templates';
import { projectLiveDocument } from '../logic/live-projection';
import type { StudioDocumentV3, StudioNode } from '../logic/document-v3';
import { Button } from '@/features/shared/ui/ui/button';
import { ToolbarButton } from '@/features/shared/ui/layout';
import { TypeaheadField } from '@/features/shared/ui/form/TypeaheadField';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { StudioPanel } from './StudioPanel';
import { closeStudioPanels } from '../logic/panel-events';
import { StudioShowTools } from './StudioShowTools';
export function StudioLiveTools({
  document,
  frameId,
  selectedId,
  selectedNodeIds,
  onSelect,
  sources,
  assets,
  update,
  portrait,
  setPortrait,
  disabled = false,
  onInsertData,
  onUpload,
}: {
  document: StudioDocumentV3;
  frameId: string;
  selectedId?: string;
  selectedNodeIds?: string[];
  onSelect?: (node: StudioNode, rootFrameId: string) => void;
  sources: LiveSource[];
  assets: { id: string; name: string; mime: string }[];
  update: (edit: (d: StudioDocumentV3) => void) => void;
  portrait: boolean;
  setPortrait: (v: boolean) => void;
  disabled?: boolean;
  onInsertData?: () => void;
  onUpload?: (
    file: File,
    background?: boolean
  ) => Promise<{ id: string; name: string; mime: string } | undefined>;
}) {
  const [type, setType] = useState<LiveBinding['sourceType']>('event');
  const [id, setId] = useState('');
  const [field, setField] = useState<LiveBinding['field']>('title');
  const [sourceRows] = useQuery(queries.studio.liveSources({ refs: [], type }));
  const rows = ((sourceRows ?? []) as unknown as LiveSource[]).filter(r => r.source_type === type);
  const choice = rows.some(r => r.source_id === id) ? id : '';
  const entityItems = toTypeaheadItems(
    rows.map(r => ({ ...r, id: r.source_id })),
    type,
    r =>
      String(
        r.payload.title ||
          r.payload.name ||
          [r.payload.first_name, r.payload.last_name].filter(Boolean).join(' ') ||
          r.source_id
      )
  );
  const node = document.nodes.find(n => n.id === selectedId);
  const boundSource = sources.find(
    s =>
      s.source_type === node?.liveBinding?.sourceType && s.source_id === node.liveBinding.sourceId
  );
  const sourceHref =
    boundSource?.event_id && ['agenda_item', 'vote', 'election'].includes(boundSource.source_type)
      ? `/event/${boundSource.event_id}/agenda`
      : `/${node?.liveBinding?.sourceType}/${node?.liveBinding?.sourceId}`;
  const selectClass = 'w-full rounded border bg-background p-2 text-sm';
  const binding = (): LiveBinding => ({
    sourceType: type,
    sourceId: choice,
    field,
    format:
      field === 'results'
        ? 'results'
        : field === 'speakers'
          ? 'speakers'
          : field === 'countdown'
            ? 'countdown'
            : field.endsWith('_time')
              ? 'datetime'
              : 'text',
  });
  return (
    <>
      {onInsertData && (
        <ToolbarButton
          data-action-id="studio.data-view.open"
          type="button"
          tooltip={translateText('features.studio.dataImport.insert')}
          onClick={() => {
            closeStudioPanels();
            onInsertData();
          }}
          disabled={disabled}
        >
          <ChartNoAxesCombinedIcon />
        </ToolbarButton>
      )}
      <StudioPanel
        panelKey="polity-data"
        label={translateText('features.studio.eventLive.data')}
        icon={<Database />}
      >
        <fieldset disabled={disabled} className="min-w-0 space-y-4 p-3">
          <label className="block text-sm">
            {translateText('features.studio.eventLive.source')}
            <select
              data-action-id="studio.live.select1.change"
              className={selectClass}
              value={type}
              onChange={e => {
                setType(e.target.value as LiveBinding['sourceType']);
                setId('');
              }}
            >
              {politySourceTypes.map(t => (
                <option key={t} value={t}>
                  {translateText(`features.studio.eventLive.sourceTypes.${t}`)}
                </option>
              ))}
            </select>
          </label>
          <div data-action-id="studio.live.select2.change">
            <TypeaheadField
              key={type}
              label={translateText('features.studio.eventLive.entity')}
              placeholder={translateText('features.studio.eventLive.searchEntity')}
              items={entityItems}
              value={choice}
              onChange={item => setId(item?.id ?? '')}
              disabled={disabled}
              disablePortal
              showAllOnFocus
            />
          </div>
          <label className="block text-sm">
            {translateText('features.studio.eventLive.value')}
            <select
              data-action-id="studio.live.select3.change"
              className={selectClass}
              value={field}
              onChange={e => setField(e.target.value as LiveBinding['field'])}
            >
              {[
                'title',
                'description',
                'status',
                'start_time',
                'end_time',
                'duration',
                'location',
                'organizer',
                'countdown',
                'times',
                'results',
                'speakers',
                'current_speaker',
                'details',
              ].map(f => (
                <option key={f} value={f}>
                  {translateText(`features.studio.eventLive.fields.${f}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              data-action-kind="interaction"
              data-action-id="studio.live.insert"
              disabled={!choice}
              onClick={() =>
                update(d => {
                  d.nodes.push(createLiveNode(binding(), frameId, d.nodes.length));
                })
              }
            >
              {translateText('features.studio.eventLive.insert')}
            </Button>
            {node && (
              <Button
                data-action-kind="interaction"
                data-action-id="studio.live.bind"
                disabled={!choice || node.type === 'frame'}
                onClick={() =>
                  update(d => {
                    const n = d.nodes.find(n => n.id === node.id);
                    if (n) n.liveBinding = binding();
                  })
                }
              >
                {translateText('features.studio.eventLive.bind')}
              </Button>
            )}
          </div>
          {node?.liveBinding && (
            <div className="space-y-2 rounded border p-2 text-sm">
              <p>
                {translateText('features.studio.eventLive.live')}
                {node.liveBinding.sourceType} · {node.liveBinding.field}
              </p>
              <a
                className="underline"
                data-action-id="studio.live.source.open"
                href={sourceHref}
                target="_blank"
                rel="noreferrer"
              >
                {translateText('features.studio.eventLive.openSource')}
              </a>
              <Button
                data-action-id="studio.live.detach"
                variant="outline"
                onClick={() =>
                  update(d => {
                    const resolved = projectLiveDocument(d, sources, { static: true });
                    const value = resolved.nodes.find(n => n.id === node.id);
                    if (value) d.nodes[d.nodes.findIndex(n => n.id === node.id)] = value;
                  })
                }
              >
                {translateText('features.studio.eventLive.detach')}
              </Button>
            </div>
          )}
        </fieldset>
      </StudioPanel>
      <StudioPanel
        panelKey="responsive-layout"
        label={translateText('features.studio.eventLive.responsiveLayout')}
        icon={<PanelsTopLeft />}
      >
        <fieldset disabled={disabled} className="min-w-0 space-y-4 p-3">
          <h3 className="hidden font-semibold md:block">
            {translateText('features.studio.eventLive.responsiveLayout')}
          </h3>
          <select
            data-action-id="studio.live.select5.change"
            aria-label={translateText('features.studio.eventLive.layoutPreview')}
            className={selectClass}
            value={portrait ? 'portrait' : 'wide'}
            onChange={e => setPortrait(e.target.value === 'portrait')}
          >
            <option value="wide">{translateText('features.studio.eventLive.wide')}</option>
            <option value="portrait">{translateText('features.studio.eventLive.portrait')}</option>
          </select>
          {node && (
            <div className="grid grid-cols-2 gap-2">
              {(['x', 'y', 'width', 'height'] as const).map(key => (
                <label key={key} className="text-xs">
                  {translateText('features.studio.eventLive.portraitField', { field: key })}
                  <input
                    data-action-id="studio.live.input1.change"
                    aria-label={translateText('features.studio.eventLive.portraitField', {
                      field: key,
                    })}
                    type="number"
                    className={selectClass}
                    value={node.portrait?.transform?.[key] ?? node.transform[key]}
                    onChange={e => {
                      const value = e.target.valueAsNumber;
                      if (
                        !Number.isFinite(value) ||
                        ((key === 'width' || key === 'height') && value <= 0)
                      )
                        return;
                      update(d => {
                        const n = d.nodes.find(n => n.id === node.id);
                        if (n)
                          n.portrait = {
                            ...n.portrait,
                            transform: { ...n.transform, ...n.portrait?.transform, [key]: value },
                          };
                      });
                    }}
                  />
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </StudioPanel>
      <StudioPanel
        panelKey="music-animation"
        unmountWhenClosed
        keepOpenOnDialogInteraction
        keepOpenOnCanvasInteraction
        label={translateText('features.studio.eventLive.musicAnimation')}
        icon={<Music />}
      >
        <StudioShowTools
          {...{
            document,
            frameId,
            selectedId,
            selectedNodeIds,
            onSelect,
            sources,
            assets,
            update,
            portrait,
            disabled,
            onUpload,
          }}
        />
      </StudioPanel>
    </>
  );
}
