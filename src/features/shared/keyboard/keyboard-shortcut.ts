import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useLanguageStore, type Language } from '@/features/shared/global-state/language.store';

export type KeyboardPlatform = 'macos' | 'windows' | 'linux';

export type KeyboardShortcutModifier = 'mod' | 'control' | 'meta' | 'alt' | 'shift';

export interface KeyboardShortcutChord {
  modifiers: readonly KeyboardShortcutModifier[];
  key: string;
}

export interface KeyboardShortcutDefinition {
  macos: KeyboardShortcutChord;
  windows: KeyboardShortcutChord;
  linux: KeyboardShortcutChord;
}

export interface ResolvedKeyboardShortcut {
  platform: KeyboardPlatform;
  chord: KeyboardShortcutChord;
  display: string;
  ariaKeyShortcuts: string;
  plateHotkey: string;
}

interface KeyboardPlatformDetectionSource {
  userAgentDataPlatform?: string;
  platform?: string;
  userAgent?: string;
}

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

const KeyboardPlatformContext = createContext<KeyboardPlatform | null>(null);

function classifyPlatform(value: string): KeyboardPlatform | undefined {
  if (/Mac|iPhone|iPad|iPod/i.test(value)) return 'macos';
  if (/Win/i.test(value)) return 'windows';
  if (/Linux|X11|CrOS|Android/i.test(value)) return 'linux';
  return undefined;
}

export function detectKeyboardPlatform(source?: KeyboardPlatformDetectionSource): KeyboardPlatform {
  const detectionSource = source ?? getNavigatorDetectionSource();
  const candidates = [
    detectionSource.userAgentDataPlatform,
    detectionSource.platform,
    detectionSource.userAgent,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const platform = classifyPlatform(candidate);
    if (platform) return platform;
  }

  return 'windows';
}

function getNavigatorDetectionSource(): KeyboardPlatformDetectionSource {
  if (typeof navigator === 'undefined') return {};

  return {
    userAgentDataPlatform: (navigator as NavigatorWithUserAgentData).userAgentData?.platform,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  };
}

export function KeyboardPlatformProvider({
  children,
  platform: platformOverride,
}: {
  children: ReactNode;
  platform?: KeyboardPlatform;
}) {
  const [platform, setPlatform] = useState<KeyboardPlatform | null>(platformOverride ?? null);

  useEffect(() => {
    setPlatform(platformOverride ?? detectKeyboardPlatform());
  }, [platformOverride]);

  return createElement(KeyboardPlatformContext.Provider, { value: platform }, children);
}

export function useKeyboardPlatform(): KeyboardPlatform | null {
  return useContext(KeyboardPlatformContext);
}

export function resolveKeyboardShortcut(
  shortcut: KeyboardShortcutDefinition,
  platform: KeyboardPlatform
): KeyboardShortcutChord {
  return shortcut[platform];
}

function resolveModifier(
  modifier: KeyboardShortcutModifier,
  platform: KeyboardPlatform
): Exclude<KeyboardShortcutModifier, 'mod'> {
  if (modifier !== 'mod') return modifier;
  return platform === 'macos' ? 'meta' : 'control';
}

function formatModifier(
  modifier: KeyboardShortcutModifier,
  platform: KeyboardPlatform,
  language: Language
): string {
  const resolved = resolveModifier(modifier, platform);
  if (resolved === 'control')
    return platform === 'macos' ? '⌃' : language === 'de' ? 'Strg' : 'Ctrl';
  if (resolved === 'meta') return platform === 'macos' ? '⌘' : 'Meta';
  if (resolved === 'alt') return platform === 'macos' ? '⌥' : 'Alt';
  return '⇧';
}

function formatKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}

export function formatKeyboardShortcut(
  shortcut: KeyboardShortcutDefinition,
  options: { platform: KeyboardPlatform; language?: Language }
): string {
  const chord = resolveKeyboardShortcut(shortcut, options.platform);
  const modifiers = chord.modifiers.map(modifier =>
    formatModifier(modifier, options.platform, options.language ?? 'en')
  );

  return [...modifiers, formatKey(chord.key)].join(' ');
}

function ariaModifier(modifier: KeyboardShortcutModifier, platform: KeyboardPlatform): string {
  const resolved = resolveModifier(modifier, platform);
  if (resolved === 'control') return 'Control';
  if (resolved === 'meta') return 'Meta';
  if (resolved === 'alt') return 'Alt';
  return 'Shift';
}

export function getAriaKeyShortcuts(
  shortcut: KeyboardShortcutDefinition,
  platform: KeyboardPlatform
): string {
  const chord = resolveKeyboardShortcut(shortcut, platform);
  return [
    ...chord.modifiers.map(modifier => ariaModifier(modifier, platform)),
    formatKey(chord.key),
  ].join('+');
}

export function matchesKeyboardShortcut(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  shortcut: KeyboardShortcutDefinition,
  platform: KeyboardPlatform
): boolean {
  const chord = resolveKeyboardShortcut(shortcut, platform);
  const modifiers = chord.modifiers.map(modifier => resolveModifier(modifier, platform));

  return (
    event.key.toLowerCase() === chord.key.toLowerCase() &&
    event.ctrlKey === modifiers.includes('control') &&
    event.metaKey === modifiers.includes('meta') &&
    event.altKey === modifiers.includes('alt') &&
    event.shiftKey === modifiers.includes('shift')
  );
}

export function getPlateHotkey(
  shortcut: KeyboardShortcutDefinition,
  platform: KeyboardPlatform
): string {
  const chord = resolveKeyboardShortcut(shortcut, platform);
  const modifiers = chord.modifiers.map(modifier => {
    const resolved = resolveModifier(modifier, platform);
    return resolved === 'control' ? 'ctrl' : resolved;
  });

  return [...modifiers, chord.key.toLowerCase()].join('+');
}

export function resolveKeyboardShortcutPresentation(
  shortcut: KeyboardShortcutDefinition,
  platform: KeyboardPlatform,
  language: Language
): ResolvedKeyboardShortcut {
  return {
    platform,
    chord: resolveKeyboardShortcut(shortcut, platform),
    display: formatKeyboardShortcut(shortcut, { platform, language }),
    ariaKeyShortcuts: getAriaKeyShortcuts(shortcut, platform),
    plateHotkey: getPlateHotkey(shortcut, platform),
  };
}

export function useResolvedKeyboardShortcut(
  shortcut: KeyboardShortcutDefinition | undefined
): ResolvedKeyboardShortcut | undefined {
  const language = useLanguageStore(state => state.language);
  const platform = useKeyboardPlatform();

  return useMemo(
    () =>
      shortcut && platform
        ? resolveKeyboardShortcutPresentation(shortcut, platform, language)
        : undefined,
    [language, platform, shortcut]
  );
}

export function useKeyboardShortcutDisplay(
  shortcut: KeyboardShortcutDefinition | undefined
): string | undefined {
  return useResolvedKeyboardShortcut(shortcut)?.display;
}
