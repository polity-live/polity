import { createGlobalStyle } from 'styled-components';
import type { FilerobotImageEditorConfig } from 'react-filerobot-image-editor';

export function readEditorCssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function translucent(color: string, opacity: number) {
  return `color-mix(in oklab, ${color} ${opacity * 100}%, transparent)`;
}

function mixed(primary: string, primaryAmount: number, secondary: string) {
  return `color-mix(in oklab, ${primary} ${primaryAmount}%, ${secondary})`;
}

export function buildEditorTheme(): NonNullable<FilerobotImageEditorConfig['theme']> {
  const background = readEditorCssVar('--background', '#f7f5ef');
  const foreground = readEditorCssVar('--foreground', '#17201c');
  const card = readEditorCssVar('--card', '#fffcf6');
  const cardForeground = readEditorCssVar('--card-foreground', foreground);
  const primary = readEditorCssVar('--primary', '#12362d');
  const primaryForeground = readEditorCssVar('--primary-foreground', '#fffcf6');
  const muted = readEditorCssVar('--muted', '#eeeae1');
  const mutedForeground = readEditorCssVar('--muted-foreground', '#65706a');
  const accent = readEditorCssVar('--accent', '#f5ecd8');
  const accentForeground = readEditorCssVar('--accent-foreground', '#6c4a16');
  const border = readEditorCssVar('--border', '#d9d2c3');
  const input = readEditorCssVar('--input', border);
  const destructive = readEditorCssVar('--destructive', '#9a3d34');
  const success = readEditorCssVar('--success', '#315c37');
  const ring = readEditorCssVar('--ring', '#b88a3b');
  const tooltip = readEditorCssVar('--tooltip', '#12362d');
  const info = readEditorCssVar('--badge-info-fg', '#28566c');
  const warning = readEditorCssVar('--badge-warning-fg', '#755015');

  const primaryHover = translucent(primary, 0.9);
  const primaryActive = mixed(primary, 82, background);
  const destructiveHover = mixed(destructive, 90, background);
  const destructiveActive = mixed(destructive, 82, background);
  const successHover = mixed(success, 90, background);
  const successActive = mixed(success, 82, background);

  return {
    palette: {
      'txt-primary': foreground,
      'txt-secondary': mutedForeground,
      'txt-secondary-invert': primaryForeground,
      'txt-placeholder': mutedForeground,
      'txt-warning': warning,
      'txt-error': destructive,
      'txt-info': info,

      'accent-primary': primary,
      'accent-primary-hover': primaryHover,
      'accent-primary-active': primaryActive,
      'accent-primary-disabled': mixed(muted, 72, background),
      'accent-secondary-disabled': muted,
      'accent-stateless': primary,
      'accent-stateless_0_4_opacity': translucent(primary, 0.4),
      accent_0_5_5_opacity: translucent(primary, 0.55),
      accent_0_5_opacity: translucent(primary, 0.05),
      accent_0_7_opacity: translucent(primary, 0.7),
      accent_1_2_opacity: translucent(primary, 0.12),
      accent_1_8_opacity: translucent(primary, 0.18),
      accent_2_8_opacity: translucent(primary, 0.28),
      accent_4_0_opacity: translucent(primary, 0.4),

      'bg-grey': muted,
      'bg-stateless': card,
      'bg-active': accent,
      'bg-base-light': muted,
      'bg-base-medium': mixed(muted, 82, background),
      'bg-primary': background,
      'bg-primary-light': background,
      'bg-primary-hover': accent,
      'bg-primary-active': accent,
      'bg-primary-stateless': input,
      'bg-primary-0-5-opacity': translucent(card, 0.5),
      'bg-secondary': card,
      'bg-hover': accent,
      'bg-green': translucent(success, 0.14),
      'bg-green-medium': translucent(success, 0.22),
      'bg-blue': translucent(info, 0.14),
      'bg-red': translucent(destructive, 0.14),
      'bg-red-light': translucent(destructive, 0.1),
      'background-red-medium': translucent(destructive, 0.22),
      'bg-orange': translucent(ring, 0.14),
      'bg-tooltip': tooltip,

      'icon-primary': foreground,
      'icons-primary': foreground,
      'icons-primary-opacity-0-6': translucent(foreground, 0.6),
      'icons-secondary': mutedForeground,
      'icons-placeholder': mutedForeground,
      'icons-invert': primaryForeground,
      'icons-muted': mutedForeground,
      'icons-primary-hover': foreground,
      'icons-secondary-hover': foreground,

      'btn-primary-text': primaryForeground,
      'btn-primary-text-0-6': translucent(primaryForeground, 0.6),
      'btn-primary-text-0-4': translucent(primaryForeground, 0.4),
      'btn-disabled-text': mutedForeground,
      'btn-secondary-text': cardForeground,

      'link-primary': foreground,
      'link-stateless': foreground,
      'link-hover': accentForeground,
      'link-active': foreground,
      'link-muted': mutedForeground,
      'link-pressed': primary,

      'borders-primary': border,
      'borders-primary-hover': ring,
      'borders-secondary': border,
      'borders-strong': foreground,
      'borders-invert': primaryForeground,
      'border-hover-bottom': translucent(ring, 0.32),
      'border-active-bottom': ring,
      'border-primary-stateless': input,
      'borders-disabled': translucent(border, 0.7),
      'borders-button': input,
      'borders-item': border,
      'borders-base-light': border,
      'borders-base-medium': mixed(border, 72, foreground),
      'borders-green': translucent(success, 0.36),
      'borders-green-medium': translucent(success, 0.56),
      'borders-red': translucent(destructive, 0.56),

      'active-secondary': card,
      'active-secondary-hover': accent,
      tag: mutedForeground,
      'states-error-disabled-text': translucent(destructive, 0.42),
      error: destructive,
      'error-0-28-opacity': translucent(destructive, 0.28),
      'error-0-12-opacity': translucent(destructive, 0.12),
      'error-hover': destructiveHover,
      'error-active': destructiveActive,
      success,
      'success-hover': successHover,
      'success-Active': successActive,
      warning: ring,
      'warning-hover': mixed(ring, 90, background),
      'warning-active': mixed(ring, 82, background),
      info,
      modified: ring,

      'light-shadow': 'rgb(0 0 0 / 0.16)',
      'medium-shadow': 'rgb(0 0 0 / 0.2)',
      'large-shadow': 'rgb(0 0 0 / 0.28)',
      'x-large-shadow': 'rgb(0 0 0 / 0.38)',
      'extra-0-3-overlay': 'rgb(0 0 0 / 0.3)',
      'extra-0-5-overlay': 'rgb(0 0 0 / 0.5)',
      'extra-0-7-overlay': 'rgb(0 0 0 / 0.7)',
      'extra-0-9-overlay': 'rgb(0 0 0 / 0.9)',
    },
    typography: {
      fontFamily: readEditorCssVar(
        '--font-sans-family',
        'Manrope, ui-sans-serif, system-ui, sans-serif'
      ),
    },
    shape: {
      borderRadius: {
        sm: '0.25rem',
        md: '0.375rem',
        lg: readEditorCssVar('--radius', '0.5rem'),
      },
    },
  };
}

export const ImageEditorVendorStyles = createGlobalStyle`
  .FIE_root .SfxInput-root,
  .FIE_root .SfxSelect-root {
    background-color: var(--card) !important;
    border: 1px solid var(--input) !important;
    color: var(--foreground) !important;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
    transition:
      color var(--motion-duration-base) var(--motion-ease-standard),
      background-color var(--motion-duration-base) var(--motion-ease-standard),
      border-color var(--motion-duration-base) var(--motion-ease-standard),
      box-shadow var(--motion-duration-base) var(--motion-ease-standard);
  }

  html.dark .FIE_root .SfxInput-root,
  html.dark .FIE_root .SfxSelect-root {
    background-color: color-mix(in oklab, var(--input) 30%, transparent) !important;
  }

  .FIE_root .SfxInput-root:hover,
  .FIE_root .SfxSelect-root:hover {
    border-color: var(--border) !important;
    color: var(--foreground) !important;
  }

  .FIE_root .SfxInput-root:focus-within,
  .FIE_root .SfxSelect-root:focus-within {
    background-color: var(--card) !important;
    border-color: var(--ring) !important;
    color: var(--foreground) !important;
    box-shadow: var(--focus-ring) !important;
  }

  html.dark .FIE_root .SfxInput-root:focus-within,
  html.dark .FIE_root .SfxSelect-root:focus-within {
    background-color: color-mix(in oklab, var(--input) 30%, transparent) !important;
  }

  .FIE_root .SfxInput-Base,
  .FIE_root .SfxSelect-Label {
    color: inherit !important;
    caret-color: var(--foreground);
  }

  .FIE_root .SfxInput-Base::placeholder,
  .FIE_root .SfxSelect-Placeholder {
    color: var(--muted-foreground) !important;
    opacity: 1;
  }

  .FIE_root input[type='number'] {
    color-scheme: light;
  }

  html.dark .FIE_root input[type='number'] {
    color-scheme: dark;
  }

  .FIE_root [data-testid^='FIE-tools-bar-item-button-']:hover,
  .FIE_root [data-testid^='FIE-tools-bar-item-button-'][aria-selected='true'] {
    background: var(--accent) !important;
    color: var(--accent-foreground) !important;
  }

  .FIE_root [data-testid^='FIE-tools-bar-item-button-']:hover *,
  .FIE_root [data-testid^='FIE-tools-bar-item-button-'][aria-selected='true'] * {
    color: var(--accent-foreground) !important;
  }

  .FIE_root .FIE_buttons-save-btn-button.SfxButton-root {
    background-color: var(--primary) !important;
    border: 1px solid transparent !important;
    border-radius: 0.375rem;
    color: var(--primary-foreground) !important;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
  }

  .FIE_root .FIE_buttons-save-btn-button.SfxButton-root:hover {
    background-color: color-mix(in oklab, var(--primary) 90%, transparent) !important;
    color: var(--primary-foreground) !important;
  }

  .FIE_root .FIE_buttons-save-btn-button.SfxButton-root:active {
    background-color: color-mix(in oklab, var(--primary) 82%, var(--background)) !important;
    color: var(--primary-foreground) !important;
  }

  .FIE_root .FIE_watermark-add-button.SfxButton-root {
    background-color: var(--card) !important;
    border: 1px solid var(--border) !important;
    border-radius: 0.375rem;
    color: var(--foreground) !important;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
  }

  html.dark .FIE_root .FIE_watermark-add-button.SfxButton-root {
    background-color: color-mix(in oklab, var(--input) 30%, transparent) !important;
    border-color: var(--input) !important;
  }

  .FIE_root .FIE_watermark-add-button.SfxButton-root:hover {
    background-color: var(--accent) !important;
    border-color: var(--border) !important;
    color: var(--accent-foreground) !important;
  }

  .FIE_root .FIE_buttons-save-btn-button.SfxButton-root:focus-visible,
  .FIE_root .FIE_watermark-add-button.SfxButton-root:focus-visible {
    border-color: var(--ring) !important;
    box-shadow: var(--focus-ring) !important;
    outline: none;
  }

  .FIE_root .FIE_buttons-save-btn-button.SfxButton-root:disabled,
  .FIE_root .FIE_watermark-add-button.SfxButton-root:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .FIE_root .FIE_buttons-save-btn-button.SfxButton-root *,
  .FIE_root .FIE_watermark-add-button.SfxButton-root * {
    color: inherit !important;
  }

  .FIE_root .SfxSlider-label {
    background-color: var(--tooltip) !important;
    border: 1px solid var(--tooltip-border);
    border-radius: 0.375rem !important;
    color: var(--tooltip-foreground) !important;
    box-shadow: var(--shadow-panel);
    font-size: 0.75rem !important;
    padding: 0.375rem 0.75rem !important;
  }

  html[data-polity-image-editor-open='true'] .SfxTooltipV2-root,
  html[data-polity-image-editor-open='true'] .SfxTooltip-root {
    background-color: var(--tooltip) !important;
    border: 1px solid var(--tooltip-border) !important;
    border-radius: 0.375rem !important;
    color: var(--tooltip-foreground) !important;
    box-shadow: var(--shadow-panel) !important;
  }

  html[data-polity-image-editor-open='true'] .SfxTooltipV2-root *,
  html[data-polity-image-editor-open='true'] .SfxTooltip-root * {
    color: var(--tooltip-foreground) !important;
  }

  html[data-polity-image-editor-open='true'] .SfxTooltipV2-root .tippy-arrow,
  html[data-polity-image-editor-open='true'] .SfxTooltip-root .tippy-arrow {
    color: var(--tooltip) !important;
  }

  html[data-polity-image-editor-open='true'] #SfxPopper .SfxMenu-root,
  html[data-polity-image-editor-open='true'] #SfxPopup .SfxMenu-root,
  html[data-polity-image-editor-open='true'] .SfxPopper-wrapper .SfxMenu-root {
    background-color: var(--popover) !important;
    border: 1px solid var(--border) !important;
    color: var(--popover-foreground) !important;
    box-shadow: var(--shadow-floating) !important;
  }

  html[data-polity-image-editor-open='true'] #SfxPopper .SfxMenuItem-root:hover,
  html[data-polity-image-editor-open='true'] #SfxPopup .SfxMenuItem-root:hover,
  html[data-polity-image-editor-open='true'] .SfxPopper-wrapper .SfxMenuItem-root:hover {
    background-color: var(--accent) !important;
    color: var(--accent-foreground) !important;
  }
`;
