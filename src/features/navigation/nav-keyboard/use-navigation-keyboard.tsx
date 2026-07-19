import { useEffect } from 'react';
import {
  commandDialogShortcut,
  isShortcutMatch,
} from '@/features/navigation/nav-keyboard/keyboard-navigation.ts';
import type { NavigationItem } from '@/features/navigation/types/navigation.types.tsx';
import {
  matchesKeyboardShortcut,
  useKeyboardPlatform,
} from '@/features/shared/keyboard/keyboard-shortcut';

/**
 * Hook for handling keyboard shortcuts in navigation
 */
export function useNavigationKeyboard({
  isActive,
  onNavigate,
  onThemeToggle,
  onKeyboardShortcutsOpen,
  onClose,
  items,
}: {
  isActive: boolean;
  onNavigate: (itemId: string) => void;
  onThemeToggle: () => void;
  onKeyboardShortcutsOpen: () => void;
  onClose: () => void;
  items: NavigationItem[];
}) {
  const platform = useKeyboardPlatform();

  useEffect(() => {
    // Only listen for shortcuts when navigation is active
    if (!isActive || !platform) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette toggle with Ctrl+K/Cmd+K is handled separately

      const matchedItem = items.find(item => isShortcutMatch(e, item.id, platform));

      if (matchedItem) {
        e.preventDefault();
        onNavigate(matchedItem.id);
        onClose?.();
        return;
      }

      if (isShortcutMatch(e, 'theme', platform) && onThemeToggle) {
        e.preventDefault();
        onThemeToggle();
        onClose?.();
        return;
      }

      if (isShortcutMatch(e, 'keyboard', platform) && onKeyboardShortcutsOpen) {
        e.preventDefault();
        onKeyboardShortcutsOpen();
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, items, onNavigate, onThemeToggle, onKeyboardShortcutsOpen, onClose, platform]);
}

export function useCommandDialogShortcut(setOpen: (open: boolean) => void, isOpen: boolean) {
  const platform = useKeyboardPlatform();

  useEffect(() => {
    if (!platform) return;

    const down = (e: KeyboardEvent) => {
      if (matchesKeyboardShortcut(e, commandDialogShortcut, platform)) {
        e.preventDefault();
        setOpen(!isOpen); // Toggle based on current state
        return;
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setOpen, isOpen, platform]);
}
