'use client';

import { useMemo, useState } from 'react';
import { toMutableJSONValue } from '@/zero/shared/helpers';
import type { Value } from 'platejs';
import { toast } from '@/features/shared/ui/ui/sonner';

import { useBlogState } from '@/zero/blogs/useBlogState';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { useDocumentState } from '@/zero/documents/useDocumentState';
import { useTranslation } from '@/features/shared/hooks/use-translation';

import type { EditorEntityType, EditorVersion } from '../types';

export interface VersionControlProps {
  entityType: EditorEntityType;
  /** Document ID for amendments/documents, blog ID for blogs */
  entityId: string;
  currentContent: Value;
  currentUserId: string;
  onRestoreVersion: (content: Value) => void;
  onVersionCreated?: (details: {
    changeSummary: string;
    versionId: string;
    versionNumber: number;
  }) => void | Promise<void>;
  /** Amendment-specific props for notifications */
  amendmentId?: string;
  amendmentTitle?: string;
}

export function useVersionControlModel({
  entityType,
  entityId,
  currentContent,
  onRestoreVersion,
  onVersionCreated,
}: VersionControlProps) {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [versionTitle, setVersionTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const { createVersion: doCreateVersion, updateVersion: doUpdateVersion } = useDocumentActions();

  // Query all versions for this entity via facade
  const isBlog = entityType === 'blog';
  const { versions: docVersions, isLoading: docVersionsLoading } = useDocumentState({
    documentId: !isBlog ? entityId : undefined,
    includeVersions: !isBlog,
  });
  const { versions: blogVersions, isLoading: blogVersionsLoading } = useBlogState({
    blogId: isBlog ? entityId : undefined,
    includeVersions: isBlog,
  });
  const versionsData = isBlog ? blogVersions : docVersions;
  const isLoading = isBlog ? blogVersionsLoading : docVersionsLoading;
  const versions = useMemo(() => {
    const seen = new Set<string>();
    return (versionsData as EditorVersion[]).filter(version => {
      if (seen.has(version.id)) return false;
      seen.add(version.id);
      return true;
    });
  }, [versionsData]);
  const sortedVersions = [...versions].sort(
    (a, b) => (b.version_number ?? 0) - (a.version_number ?? 0)
  );

  // Filter versions based on search query
  const filteredVersions = useMemo(() => {
    if (!searchQuery.trim()) return sortedVersions;

    const query = searchQuery.toLowerCase();
    return sortedVersions.filter(
      version =>
        (version.change_summary ?? '').toLowerCase().includes(query) ||
        (version.version_number ?? 0).toString().includes(query) ||
        [version.author?.first_name, version.author?.last_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
    );
  }, [sortedVersions, searchQuery]);

  // Create a new version manually
  const handleCreateVersion = async () => {
    if (!versionTitle.trim()) {
      toast.error(t('features.editor.versionControl.enterTitle'));
      return;
    }

    setIsCreating(true);
    try {
      const nextVersionNumber =
        versions.length > 0 ? Math.max(...versions.map(v => v.version_number ?? 0)) + 1 : 1;

      const versionId = crypto.randomUUID();
      await doCreateVersion({
        id: versionId,
        version_number: nextVersionNumber,
        change_summary: versionTitle,
        content: toMutableJSONValue(currentContent),
        document_id: entityType === 'blog' ? '' : entityId,
        amendment_id: null,
        blog_id: entityType === 'blog' ? entityId : null,
      });

      await onVersionCreated?.({
        changeSummary: versionTitle,
        versionId,
        versionNumber: nextVersionNumber,
      });

      toast.success(
        t('features.editor.versionControl.versionCreated').replace(
          '{{number}}',
          String(nextVersionNumber)
        )
      );

      setVersionTitle('');
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create version:', error);
      toast.error(t('features.editor.versionControl.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  // Restore a version
  const handleRestoreVersion = async (version: EditorVersion) => {
    try {
      onRestoreVersion(version.content as Value);
      toast.success(
        t('features.editor.versionControl.restoredTo').replace(
          '{{number}}',
          String(version.version_number ?? 0)
        )
      );
      setIsHistoryDialogOpen(false);
    } catch (error) {
      console.error('Failed to restore version:', error);
      toast.error(t('features.editor.versionControl.restoreFailed'));
    }
  };

  // Start editing a version title
  const startEditingTitle = (version: EditorVersion) => {
    setEditingVersionId(version.id);
    setEditingTitle(version.change_summary ?? '');
  };

  // Save edited version title
  const saveEditedTitle = async (versionId: string) => {
    if (!editingTitle.trim()) {
      toast.error(t('features.editor.versionControl.enterTitle'));
      return;
    }

    try {
      await doUpdateVersion({
        id: versionId,
        change_summary: editingTitle,
      });
      toast.success(t('features.editor.versionControl.titleUpdated'));
      setEditingVersionId(null);
      setEditingTitle('');
    } catch (error) {
      console.error('Failed to update version title:', error);
      toast.error(t('features.editor.versionControl.titleUpdateFailed'));
    }
  };

  // Format date
  const formatDate = (date: number) => {
    const d = new Date(date);
    return d.toLocaleString();
  };

  return {
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
    versionCount: versions.length,
    versionTitle,
  };
}

export type VersionControlModel = ReturnType<typeof useVersionControlModel>;
