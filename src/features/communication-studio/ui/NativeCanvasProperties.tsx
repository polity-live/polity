import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  EyeOff,
  Group,
  Lock,
  Trash2,
  Ungroup,
  Unlock,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';

export type NativeSelectionAction =
  | 'back'
  | 'backward'
  | 'forward'
  | 'front'
  | 'group'
  | 'ungroup'
  | 'duplicate'
  | 'delete'
  | 'lock'
  | 'unlock'
  | 'hide';

const fallbackColors = ['#1b1b1f', '#ffffff', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];

function IconAction({
  label,
  disabled,
  pressed,
  className,
  style,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          className={className}
          style={style}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="polity-property-number">
      <span>{label}</span>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        onChange={event => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  colors = fallbackColors,
  onChange,
}: {
  label: string;
  value: string;
  colors?: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="polity-property-section">
      <legend>{label}</legend>
      <div className="polity-color-row">
        {colors.map(color => (
          <IconAction
            key={color}
            label={`${label} ${color}`}
            className="polity-color-swatch"
            style={{ background: color }}
            pressed={value.toLowerCase() === color}
            onClick={() => onChange(color)}
          />
        ))}
        <Tooltip>
          <label className="polity-color-custom">
            <TooltipTrigger asChild>
              <input
                type="color"
                aria-label={`${label} – custom`}
                value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
                onChange={event => onChange(event.currentTarget.value)}
              />
            </TooltipTrigger>
          </label>
          <TooltipContent side="right">{`${label} – custom`}</TooltipContent>
        </Tooltip>
      </div>
    </fieldset>
  );
}

export function NativeCanvasProperties({
  elements,
  disabled,
  patch,
  action,
  format,
  canFormat,
  canGroup,
  canUngroup,
  de,
  themeColors,
}: {
  elements: readonly ExcalidrawElement[];
  disabled: boolean;
  patch: (change: Record<string, unknown>) => void;
  action: (action: NativeSelectionAction) => void;
  format: (style: 'bold' | 'italic' | 'underline') => void;
  canFormat: boolean;
  canGroup?: boolean;
  canUngroup?: boolean;
  de: boolean;
  themeColors?: readonly string[];
}) {
  const e = elements[0];
  if (!e) return null;
  const multiple = elements.length > 1;
  const bound = !!e.boundElements?.length || ('containerId' in e && !!e.containerId);
  const hasText = elements.every(element => element.type === 'text');
  const hasFill = elements.every(element =>
    ['rectangle', 'ellipse', 'diamond', 'text', 'frame'].includes(element.type)
  );
  const hasStroke = elements.every(element => element.type !== 'image');
  const text = e.type === 'text' ? e : null;
  const readCommon = (key: keyof ExcalidrawElement) =>
    elements.every(element => element[key] === e[key]) ? e[key] : undefined;
  const fill = String(readCommon('backgroundColor') ?? e.backgroundColor ?? 'transparent');
  const stroke = String(readCommon('strokeColor') ?? e.strokeColor ?? '#1b1b1f');
  const locked = elements.every(element => element.locked);

  return (
    <fieldset disabled={disabled} className="polity-native-properties">
      <header>
        <strong>
          {multiple
            ? `${elements.length} ${de ? 'Elemente' : 'elements'}`
            : e.type === 'frame'
              ? 'Frame'
              : de
                ? 'Element'
                : 'Element'}
        </strong>
        <span>{multiple ? (de ? 'Mehrfachauswahl' : 'Multiple selection') : e.type}</span>
      </header>

      {!multiple && (
        <fieldset className="polity-property-section" disabled={locked || bound}>
          <legend>{de ? 'Position & Größe' : 'Position & size'}</legend>
          <div className="polity-property-grid">
            <NumberField label="X" value={e.x} onChange={x => patch({ x })} />
            <NumberField label="Y" value={e.y} onChange={y => patch({ y })} />
            <NumberField
              label={de ? 'B' : 'W'}
              value={e.width}
              min={1}
              onChange={width => patch({ width })}
            />
            <NumberField
              label="H"
              value={e.height}
              min={1}
              onChange={height => patch({ height })}
            />
            <NumberField
              label="°"
              value={(e.angle * 180) / Math.PI}
              onChange={rotation => patch({ angle: (rotation * Math.PI) / 180 })}
            />
            <NumberField
              label="%"
              value={e.opacity}
              min={0}
              max={100}
              onChange={opacity => patch({ opacity })}
            />
          </div>
        </fieldset>
      )}

      {hasStroke && (
        <ColorField
          label={de ? 'Kontur' : 'Stroke'}
          value={stroke}
          colors={themeColors}
          onChange={strokeColor => patch({ strokeColor })}
        />
      )}
      {hasFill && (
        <>
          <ColorField
            label={de ? 'Füllung' : 'Fill'}
            value={fill}
            colors={themeColors}
            onChange={backgroundColor => patch({ backgroundColor })}
          />
          <fieldset className="polity-property-section">
            <legend>{de ? 'Füllstil' : 'Fill style'}</legend>
            <div className="polity-segmented">
              {(['solid', 'hachure', 'cross-hatch'] as const).map(fillStyle => (
                <IconAction
                  key={fillStyle}
                  label={
                    de
                      ? {
                          solid: 'Einfarbig',
                          hachure: 'Schraffiert',
                          'cross-hatch': 'Kreuzschraffur',
                        }[fillStyle]
                      : { solid: 'Solid', hachure: 'Hachure', 'cross-hatch': 'Cross-hatch' }[
                          fillStyle
                        ]
                  }
                  pressed={e.fillStyle === fillStyle}
                  onClick={() => patch({ fillStyle })}
                >
                  {fillStyle === 'solid' ? '■' : fillStyle === 'hachure' ? '▨' : '▦'}
                </IconAction>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {hasStroke && (
        <fieldset className="polity-property-section">
          <legend>{de ? 'Kontur & Stil' : 'Stroke & style'}</legend>
          <div className="polity-property-grid">
            <NumberField
              label={de ? 'Stärke' : 'Width'}
              value={Number(readCommon('strokeWidth') ?? e.strokeWidth)}
              min={0}
              max={100}
              onChange={strokeWidth => patch({ strokeWidth })}
            />
            <NumberField
              label={de ? 'Rau' : 'Rough'}
              value={Number(readCommon('roughness') ?? e.roughness)}
              min={0}
              max={2}
              onChange={roughness => patch({ roughness })}
            />
          </div>
          <div className="polity-segmented">
            {(['solid', 'dashed', 'dotted'] as const).map(strokeStyle => (
              <IconAction
                key={strokeStyle}
                label={
                  de
                    ? { solid: 'Durchgezogen', dashed: 'Gestrichelt', dotted: 'Gepunktet' }[
                        strokeStyle
                      ]
                    : { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' }[strokeStyle]
                }
                pressed={e.strokeStyle === strokeStyle}
                onClick={() => patch({ strokeStyle })}
              >
                {strokeStyle === 'solid' ? '—' : strokeStyle === 'dashed' ? '- -' : '···'}
              </IconAction>
            ))}
          </div>
        </fieldset>
      )}

      {hasText && text && (
        <fieldset className="polity-property-section">
          <legend>{de ? 'Text' : 'Text'}</legend>
          <div className="polity-property-grid">
            <NumberField
              label={de ? 'Größe' : 'Size'}
              value={text.fontSize}
              min={8}
              max={300}
              onChange={fontSize => {
                const current = text.fontSize || 1;
                patch({
                  fontSize,
                  width: (text.width * fontSize) / current,
                  height: (text.height * fontSize) / current,
                });
              }}
            />
          </div>
          <div className="polity-segmented">
            {(['bold', 'italic', 'underline'] as const).map(style => (
              <IconAction
                key={style}
                disabled={!canFormat || multiple}
                label={
                  de ? { bold: 'Fett', italic: 'Kursiv', underline: 'Unterstrichen' }[style] : style
                }
                onClick={() => format(style)}
              >
                {style === 'bold' ? <b>B</b> : style === 'italic' ? <i>I</i> : <u>U</u>}
              </IconAction>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="polity-property-section">
        <legend>{de ? 'Ebenen' : 'Layers'}</legend>
        <div className="polity-action-row">
          <IconAction
            label={de ? 'Ganz nach hinten' : 'Send to back'}
            onClick={() => action('back')}
          >
            <ArrowDownToLine />
          </IconAction>
          <IconAction
            label={de ? 'Nach hinten' : 'Send backward'}
            onClick={() => action('backward')}
          >
            <ArrowDown />
          </IconAction>
          <IconAction label={de ? 'Nach vorne' : 'Bring forward'} onClick={() => action('forward')}>
            <ArrowUp />
          </IconAction>
          <IconAction
            label={de ? 'Ganz nach vorne' : 'Bring to front'}
            onClick={() => action('front')}
          >
            <ArrowUpToLine />
          </IconAction>
        </div>
      </fieldset>

      <fieldset className="polity-property-section">
        <legend>{de ? 'Aktionen' : 'Actions'}</legend>
        <div className="polity-action-row">
          <IconAction
            label={de ? 'Gruppieren' : 'Group'}
            disabled={canGroup === undefined ? elements.length < 2 : !canGroup}
            onClick={() => action('group')}
          >
            <Group />
          </IconAction>
          <IconAction
            label={de ? 'Gruppe lösen' : 'Ungroup'}
            disabled={canUngroup === false}
            onClick={() => action('ungroup')}
          >
            <Ungroup />
          </IconAction>
          <IconAction label={de ? 'Duplizieren' : 'Duplicate'} onClick={() => action('duplicate')}>
            <Copy />
          </IconAction>
          <IconAction
            label={locked ? (de ? 'Entsperren' : 'Unlock') : de ? 'Sperren' : 'Lock'}
            onClick={() => action(locked ? 'unlock' : 'lock')}
          >
            {locked ? <Unlock /> : <Lock />}
          </IconAction>
          <IconAction label={de ? 'Ausblenden' : 'Hide'} onClick={() => action('hide')}>
            <EyeOff />
          </IconAction>
          <IconAction label={de ? 'Löschen' : 'Delete'} onClick={() => action('delete')}>
            <Trash2 />
          </IconAction>
        </div>
      </fieldset>
    </fieldset>
  );
}
