import { MoreHorizontal } from 'lucide-react';

import { LanguageToggle } from '@/features/navigation/toggles/language-toggle.tsx';
import { StateToggle } from '@/features/navigation/toggles/state-toggle.tsx';
import { ThemeToggle } from '@/features/navigation/toggles/theme-toggle.tsx';
import type { NavigationView } from '@/features/navigation/types/navigation.types.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';

interface StateSwitcherViewProps {
  isMobile: boolean;
  navigationView: NavigationView;
  isPrimary: boolean;
  isExpanded: boolean;
  isDropdownOpen: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  setIsDropdownOpen: (isDropdownOpen: boolean) => void;
  setNavigationView: (navigationView: NavigationView) => void;
  onMobileTriggerMouseEnter: () => void;
  onMobileMenuMouseEnter: () => void;
  onMobileMenuMouseLeave: () => void;
  onDesktopTriggerMouseEnter: () => void;
  onDesktopMenuMouseEnter: () => void;
  onDesktopMenuMouseLeave: () => void;
  onMobileStateChange: (navigationView: NavigationView) => void;
  onDesktopStateChange: (navigationView: NavigationView) => void;
}

export function StateSwitcherView({
  isMobile,
  navigationView,
  isPrimary,
  isExpanded,
  isDropdownOpen,
  setIsExpanded,
  setIsDropdownOpen,
  setNavigationView,
  onMobileTriggerMouseEnter,
  onMobileMenuMouseEnter,
  onMobileMenuMouseLeave,
  onDesktopTriggerMouseEnter,
  onDesktopMenuMouseEnter,
  onDesktopMenuMouseLeave,
  onMobileStateChange,
  onDesktopStateChange,
}: StateSwitcherViewProps) {
  if (navigationView === 'asLabeledButtonList' && !isMobile) {
    return (
      <div className="flex items-center gap-3">
        <StateToggle currentState={navigationView} onStateChange={setNavigationView} size="small" />
        <div className="bg-border h-8 w-px" />
        <LanguageToggle size="small" />
        <div className="bg-border h-8 w-px" />
        <ThemeToggle size="small" />
      </div>
    );
  }

  if (['asButtonList', 'asLabeledButtonList'].includes(navigationView) && isMobile) {
    return (
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-accent h-12 w-12"
            onMouseEnter={onMobileTriggerMouseEnter}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isPrimary ? 'top' : 'top'}
          align="end"
          className="p-1"
          style={{ width: 'max-content', minWidth: 'fit-content' }}
          sideOffset={5}
          onMouseEnter={onMobileMenuMouseEnter}
          onMouseLeave={onMobileMenuMouseLeave}
        >
          <div className="px-1 py-1">
            <ThemeToggle size="small" />
          </div>
          <DropdownMenuSeparator />
          <LanguageToggle size="small" variant="dropdown" />
          <DropdownMenuSeparator />
          <div className="p-1">
            <StateToggle
              currentState={navigationView}
              onStateChange={onMobileStateChange}
              size="small"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (navigationView === 'asButtonList' && !isMobile) {
    return (
      <DropdownMenu open={isExpanded} onOpenChange={setIsExpanded}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onMouseEnter={onDesktopTriggerMouseEnter}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isPrimary ? 'right' : 'left'}
          align="start"
          className="p-1"
          style={{ width: 'max-content', minWidth: 'fit-content' }}
          sideOffset={5}
          onMouseEnter={onDesktopMenuMouseEnter}
          onMouseLeave={onDesktopMenuMouseLeave}
        >
          <div className="px-1 py-1">
            <ThemeToggle size="small" />
          </div>
          <DropdownMenuSeparator />
          <LanguageToggle size="small" variant="dropdown" />
          <DropdownMenuSeparator />
          <div className="p-1">
            <StateToggle
              currentState={navigationView}
              onStateChange={onDesktopStateChange}
              size="small"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (navigationView === 'asButton') {
    return (
      <div className="bg-background/95 absolute bottom-8 left-1/2 flex -translate-x-1/2 transform gap-2 rounded-full border p-2 shadow-lg backdrop-blur-sm">
        <StateToggle currentState={navigationView} onStateChange={setNavigationView} />
        <div className="bg-border mx-1 w-px" />
        <LanguageToggle />
        <div className="bg-border mx-1 w-px" />
        <ThemeToggle size="default" />
      </div>
    );
  }

  return null;
}
