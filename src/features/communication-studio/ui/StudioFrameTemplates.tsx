import { useState } from 'react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { TypeaheadField } from '@/features/shared/ui/form/TypeaheadField';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { Button } from '@/features/shared/ui/ui/button';
import { useQuery } from '@/zero/observed-query';
import { queries } from '@/zero/queries';
import type { StudioDocumentV3 } from '../logic/document-v3';
import { createEventTemplate, eventTemplateTypes } from '../logic/event-templates';
import { politySourceTypes, type LiveBinding, type LiveSource } from '../logic/live-contract';

// Keep the selection in the editor while the dropdown content is unmounted.
export function useStudioFrameTemplateSelection() {
  const [type, setType] = useState<LiveBinding['sourceType']>('event');
  const [id, setId] = useState('');
  const [template, setTemplate] = useState('cover');
  return { type, setType, id, setId, template, setTemplate };
}

export function StudioFrameTemplates({
  selection,
  update,
  disabled = false,
}: {
  selection: ReturnType<typeof useStudioFrameTemplateSelection>;
  update: (edit: (d: StudioDocumentV3) => void) => void;
  disabled?: boolean;
}) {
  const { type, setType, id, setId, template, setTemplate } = selection;
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
  const selectClass = 'w-full rounded border bg-background p-2 text-sm';
  return (
    <fieldset
      data-action-id="studio.template.keyboard"
      disabled={disabled}
      className="w-80 max-w-full min-w-0 space-y-4 p-3"
      onKeyDown={event => {
        // Let form controls handle typing, arrows and Tab instead of menu navigation.
        if (event.key !== 'Escape') event.stopPropagation();
      }}
    >
      <legend className="sr-only">{translateText('features.studio.eventLive.template')}</legend>
      <label className="block text-sm">
        {translateText('features.studio.eventLive.source')}
        <select
          data-action-id="studio.template.source.change"
          className={selectClass}
          value={type}
          onChange={event => {
            setType(event.target.value as LiveBinding['sourceType']);
            setId('');
          }}
        >
          {politySourceTypes.map(sourceType => (
            <option key={sourceType} value={sourceType}>
              {translateText(`features.studio.eventLive.sourceTypes.${sourceType}`)}
            </option>
          ))}
        </select>
      </label>
      <div data-action-id="studio.template.entity.change">
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
        {translateText('features.studio.eventLive.template')}
        <select
          data-action-id="studio.live.select4.change"
          className={selectClass}
          value={template}
          onChange={event => setTemplate(event.target.value)}
        >
          {eventTemplateTypes.map(templateType => (
            <option key={templateType} value={templateType}>
              {translateText(`features.studio.eventLive.templates.${templateType}`)}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        data-action-kind="interaction"
        data-action-id="studio.live.template"
        disabled={disabled || !choice}
        onClick={() => {
          if (disabled || !choice) return;
          update(d => {
            const added = createEventTemplate(
              template,
              choice,
              d.nodes.filter(n => n.type === 'frame').length,
              d.theme
            );
            for (const node of added.nodes) {
              delete node.eventTemplateSlot;
              if (node.type === 'frame') delete node.eventSource;
              if (node.liveBinding) node.liveBinding.sourceType = type;
            }
            d.nodes.push(...added.nodes);
          });
        }}
      >
        {translateText('features.studio.eventLive.addTemplate')}
      </Button>
    </fieldset>
  );
}
