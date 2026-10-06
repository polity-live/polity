import type { ReactNode } from 'react';
import { InlineCheckbox } from '@/features/shared/ui/form/InlineCheckbox';
import type { StudioNode } from '../logic/document-v3';

type NumericKey = 'x' | 'y' | 'width' | 'height' | 'rotation';

/** Properties for V5 nodes that have no legacy StudioElement projection. */
export function StudioCanonicalProperties({
  node,
  update,
  tr,
}: {
  node: StudioNode;
  update: (change: (node: StudioNode) => void) => void;
  tr: (key: string) => string;
}) {
  const input = 'w-full rounded-md border bg-background px-2 py-1.5 text-sm';
  const field = (label: string, control: ReactNode) => (
    <label className="block space-y-1 text-xs">
      <span>{tr(label)}</span>
      {control}
    </label>
  );
  const number = (label: string, key: NumericKey, min: number, max: number) =>
    field(
      label,
      <input
        data-action-id="studio.node.geometry.edit"
        data-action-kind="interaction"
        className={input}
        type="number"
        min={min}
        max={max}
        value={node.transform[key]}
        onChange={event => {
          const value = event.currentTarget.valueAsNumber;
          if (Number.isFinite(value) && value >= min && value <= max)
            update(target => {
              target.transform[key] = value;
            });
        }}
      />
    );
  return (
    <div className="space-y-3">
      {field(
        'name',
        <input
          data-action-id="studio.node.name.edit"
          data-action-kind="interaction"
          className={input}
          value={node.name}
          maxLength={200}
          onChange={event => {
            if (event.target.value.trim())
              update(target => {
                target.name = event.target.value;
              });
          }}
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        {number('X', 'x', -4000, 4000)}
        {number('Y', 'y', -4000, 4000)}
        {number('width', 'width', 1, 5000)}
        {number('height', 'height', 1, 5000)}
        {number('rotation', 'rotation', -360, 360)}
        {field(
          'opacity',
          <input
            data-action-id="studio.node.opacity.edit"
            data-action-kind="interaction"
            className={input}
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={node.style.opacity}
            onChange={event => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value) && value >= 0 && value <= 1)
                update(target => {
                  target.style.opacity = value;
                });
            }}
          />
        )}
        {field(
          'order',
          <input
            data-action-id="studio.node.order.edit"
            data-action-kind="interaction"
            className={input}
            type="number"
            min={-1000000}
            max={1000000}
            value={node.zIndex}
            onChange={event => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isInteger(value) && value >= -1000000 && value <= 1000000)
                update(target => {
                  target.zIndex = value;
                });
            }}
          />
        )}
        {field(
          'strokeWidth',
          <input
            data-action-id="studio.node.stroke-width.edit"
            data-action-kind="interaction"
            className={input}
            type="number"
            min={0}
            max={100}
            value={node.style.strokeWidth}
            onChange={event => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value) && value >= 0 && value <= 100)
                update(target => {
                  target.style.strokeWidth = value;
                });
            }}
          />
        )}
      </div>
      {field(
        'color',
        <input
          data-action-id="studio.node.fill.edit"
          data-action-kind="interaction"
          type="color"
          value={node.style.fill ?? '#ffffff'}
          onChange={event =>
            update(target => {
              target.style.fill = event.target.value;
              target.style.fillBinding = null;
            })
          }
        />
      )}
      {field(
        'border',
        <input
          data-action-id="studio.node.stroke.edit"
          data-action-kind="interaction"
          type="color"
          value={node.style.stroke ?? '#000000'}
          onChange={event =>
            update(target => {
              target.style.stroke = event.target.value;
              target.style.strokeBinding = null;
            })
          }
        />
      )}
      <label className="flex items-center gap-2 text-xs">
        <InlineCheckbox
          data-action-id="studio.node.lock.toggle"
          checked={node.locked}
          onCheckedChange={value =>
            update(target => {
              target.locked = value === true;
            })
          }
        />
        {tr('locked')}
      </label>
      {node.type === 'frame' && (
        <label className="flex items-center gap-2 text-xs">
          <InlineCheckbox
            data-action-id="studio.node.clipping.toggle"
            checked={node.clipContent}
            onCheckedChange={value =>
              update(target => {
                if (target.type === 'frame') target.clipContent = value === true;
              })
            }
          />
          {tr('clipContent')}
        </label>
      )}
      {node.type === 'media' && (
        <>
          {field(
            'text',
            <input
              data-action-id="studio.node.description.edit"
              data-action-kind="interaction"
              className={input}
              value={node.alt}
              maxLength={2000}
              onChange={event =>
                update(target => {
                  if (target.type === 'media') target.alt = event.target.value;
                })
              }
            />
          )}
          {(node.mediaType === 'image' || node.mediaType === 'video') &&
            field(
              'fit',
              <select
                data-action-id="studio.node.fitting.select"
                className={input}
                value={node.fit}
                onChange={event =>
                  update(target => {
                    if (target.type === 'media')
                      target.fit = event.target.value as 'contain' | 'cover';
                  })
                }
              >
                <option value="contain">{tr('contain')}</option>
                <option value="cover">{tr('cover')}</option>
              </select>
            )}
          {(node.mediaType === 'audio' || node.mediaType === 'video') && (
            <label className="flex items-center gap-2 text-xs">
              <InlineCheckbox
                data-action-id="studio.node.muting.toggle"
                checked={node.muted}
                onCheckedChange={value =>
                  update(target => {
                    if (target.type === 'media') target.muted = value === true;
                  })
                }
              />
              {tr('muted')}
            </label>
          )}
        </>
      )}
      {node.type === 'embed' &&
        field(
          'embedContent',
          <textarea
            data-action-id="studio.node.embed.edit"
            className={input}
            rows={5}
            value={node.value}
            onChange={event =>
              update(target => {
                if (target.type === 'embed') target.value = event.target.value;
              })
            }
          />
        )}
    </div>
  );
}
