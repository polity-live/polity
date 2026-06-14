'use client';

import {
  Check,
  Clock,
  GitBranch,
  History,
  Loader2,
  Pencil,
  Plus,
  Search,
  User,
  X,
} from 'lucide-react';

import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { BadgeControl } from '@/features/shared/ui/status/StatusBadges';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { useTranslation } from '@/features/shared/hooks/use-translation';

import type { VersionControlModel } from '../hooks/useVersionControlModel';

interface VersionControlViewProps {
  model: VersionControlModel;
}

export function VersionControlView({ model }: VersionControlViewProps) {
  const {
    editingTitle,
    editingVersionId,
    filteredVersions,
    formatDate,
    handleCreateVersion,
    handleRestoreVersion,
    isCreateDialogOpen,
    isCreating,
    isHistoryDialogOpen,
    isLoading,
    saveEditedTitle,
    searchQuery,
    setEditingTitle,
    setEditingVersionId,
    setIsCreateDialogOpen,
    setIsHistoryDialogOpen,
    setSearchQuery,
    setVersionTitle,
    startEditingTitle,
    versionCount,
    versionTitle,
  } = model;
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      {/* Create Version Button */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t('features.editor.versionControl.saveVersion')}
          </Button>
        </DialogTrigger>
        <ScrollableDialogContent>
          <DialogHeader>
            <DialogTitle>{t('features.editor.versionControl.createVersion')}</DialogTitle>
            <DialogDescription>
              {t('features.editor.versionControl.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <FormControlLabel htmlFor="version-title">
                {t('features.editor.versionControl.versionTitle')}
              </FormControlLabel>
              <FormControlInput
                id="version-title"
                value={versionTitle}
                onChange={e => setVersionTitle(e.target.value)}
                placeholder={t('features.editor.versionControl.titlePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateVersion} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('features.editor.versionControl.save')}
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>

      {/* Version History Button */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <History className="mr-2 h-4 w-4" />
            {t('features.editor.versionControl.history')}
            {versionCount > 0 && (
              <BadgeControl variant="secondary" className="ml-2">
                {versionCount}
              </BadgeControl>
            )}
          </Button>
        </DialogTrigger>
        <ScrollableDialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('features.editor.versionControl.versionHistory')}</DialogTitle>
            <DialogDescription>
              {t('features.editor.versionControl.historyDescription')}
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <FormControlInput
              placeholder={t('features.editor.versionControl.searchVersions')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : filteredVersions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <GitBranch className="text-muted-foreground mb-2 h-8 w-8" />
                <p className="text-muted-foreground text-sm">
                  {searchQuery
                    ? t('features.editor.versionControl.noMatchingVersions')
                    : t('features.editor.versionControl.noVersions')}
                </p>
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                {filteredVersions.map(version => (
                  <div
                    key={version.id}
                    className="hover:bg-muted/50 flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <BadgeControl variant="outline">
                          v{version.version_number ?? 0}
                        </BadgeControl>
                        {editingVersionId === version.id ? (
                          <div className="flex items-center gap-1">
                            <FormControlInput
                              value={editingTitle}
                              onChange={e => setEditingTitle(e.target.value)}
                              className="h-7 w-48"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => saveEditedTitle(version.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingVersionId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium">{version.change_summary ?? ''}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => startEditingTitle(version)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-1 flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(version.created_at)}
                        </span>
                        {version.author && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {[version.author.first_name, version.author.last_name]
                              .filter(Boolean)
                              .join(' ') || version.author.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreVersion(version)}
                    >
                      {t('features.editor.versionControl.restore')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </ScrollableDialogContent>
      </Dialog>
    </div>
  );
}
