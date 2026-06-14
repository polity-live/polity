'use client';

import { Link } from '@tanstack/react-router';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';

import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { PlateEditor } from '@/features/shared/ui/kit-platejs/plate-editor';
import { BadgeControl } from '@/features/shared/ui/status/StatusBadges';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/features/shared/ui/ui/card';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { generateUserColor } from '../logic/editor-helpers';
import type { EditorViewModel } from '../hooks/useEditorViewModel';

import { EditorHeader } from './EditorHeader';
import { InviteCollaboratorDialog } from './InviteCollaboratorDialog';
import { SuggestionViewToggle } from './SuggestionViewToggle';
import { VersionControl } from './VersionControl';

interface EditorViewShellProps {
  model: EditorViewModel;
}

export function EditorViewShell({ model }: EditorViewShellProps) {
  const {
    activeCursorUserIds,
    amendmentId,
    amendmentTitle,
    backLabel,
    backUrl,
    capabilities,
    content,
    contentEntityId,
    currentUser,
    defaultBackLabel,
    defaultBackUrl,
    discussions,
    editorUsers,
    entity,
    entityId,
    entityType,
    existingCollaboratorIds,
    goBack,
    hasAccess,
    hasUnsavedChanges,
    isEditingTitle,
    isLoading,
    isOwnerOrCollaborator,
    isSavingTitle,
    mode,
    onSuggestionAccepted,
    onSuggestionDeclined,
    onVoteAbstain,
    onVoteAccept,
    onVoteReject,
    onlinePeerMap,
    onlinePeers,
    readOnly,
    restoreVersion,
    saveStatus,
    selectedCrIds,
    setActiveCursorUserIds,
    setContent,
    setDiscussions,
    setIsEditingTitle,
    setMode,
    setSelectedCrIds,
    setTitle,
    statusBadgeLabel,
    title,
    userColor,
    userId,
  } = model;
  const { t } = useTranslation();

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Not found state
  if (!entity) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground mb-4 text-lg">
            {t('features.editor.errors.notFound')}
          </p>
          <Button onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel || defaultBackLabel}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No access state
  if (!hasAccess) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground mb-4 text-lg">
            {t('features.editor.errors.noAccess')}
          </p>
          <Button onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel || defaultBackLabel}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-8">
      {/* Top toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <Link to={backUrl || defaultBackUrl}>
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel || defaultBackLabel}
          </Button>
        </Link>

        <div className="flex items-center gap-4">
          {/* Share Button */}
          {capabilities.sharing && (
            <ShareButton
              url={`/${entityType}/${entityId}`}
              title={title}
              description={entity.metadata?.amendmentCode || ''}
            />
          )}

          {/* Version Control */}
          {capabilities.versioning && userId && contentEntityId && !readOnly && (
            <VersionControl
              entityType={entityType}
              entityId={contentEntityId}
              currentContent={content}
              currentUserId={userId}
              onRestoreVersion={restoreVersion}
              amendmentId={amendmentId}
              amendmentTitle={amendmentTitle}
            />
          )}

          {/* Suggestion View Toggle (visible in suggest/vote modes) */}
          {(mode === 'suggest_internal' ||
            mode === 'suggest_event' ||
            mode === 'vote_internal' ||
            mode === 'vote_event') &&
            discussions.length > 0 && (
              <SuggestionViewToggle
                discussions={discussions}
                selectedCrIds={selectedCrIds}
                onSelectedCrIdsChange={setSelectedCrIds}
              />
            )}

          {/* Invite Collaborators */}
          {capabilities.invites && userId && !readOnly && (
            <InviteCollaboratorDialog
              entityType={entityType}
              entityId={contentEntityId}
              currentUserId={userId}
              entityTitle={title}
              existingCollaboratorIds={existingCollaboratorIds}
            />
          )}

          {statusBadgeLabel ? (
            <BadgeControl variant="outline" className="capitalize">
              {statusBadgeLabel}
            </BadgeControl>
          ) : null}
        </div>
      </div>

      {/* Editor Card */}
      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center gap-4">
            <FileText className="h-8 w-8" />
            <EditorHeader
              title={title}
              onTitleChange={setTitle}
              isEditingTitle={isEditingTitle}
              setIsEditingTitle={setIsEditingTitle}
              canEditTitle={!readOnly}
              isSavingTitle={isSavingTitle}
              saveStatus={saveStatus}
              hasUnsavedChanges={hasUnsavedChanges}
              onlinePeers={onlinePeers}
              showPresence={capabilities.presence}
            />
          </div>
          <CardDescription>{t('features.editor.description')}</CardDescription>

          {/* Entity-specific metadata */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            {entity.metadata?.amendmentCode && (
              <BadgeControl variant="secondary" className="font-mono">
                {entity.metadata.amendmentCode}
              </BadgeControl>
            )}
            {entity.metadata?.amendmentDate && (
              <span className="text-muted-foreground">
                {t('features.editor.metadata.date')}: {entity.metadata.amendmentDate}
              </span>
            )}
            {entity.metadata?.amendmentSupporters !== undefined && (
              <span className="text-muted-foreground">
                {entity.metadata.amendmentSupporters} {t('features.editor.metadata.supporters')}
              </span>
            )}
            {entity.metadata?.blogUpvotes !== undefined && (
              <span className="text-muted-foreground">
                {entity.metadata.blogUpvotes} {t('features.editor.metadata.upvotes')}
              </span>
            )}
          </div>

          {/* Collaborators list */}
          {entity.collaborators.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {t('features.editor.metadata.collaborators')}:
              </span>
              {entity.collaborators.map(collab => {
                const isOnline =
                  onlinePeerMap.has(collab.user.id) ||
                  collab.user.id === userId ||
                  activeCursorUserIds.has(collab.user.id);
                const userColor = generateUserColor(collab.user.id);

                return (
                  <div
                    key={collab.id}
                    className="bg-muted relative flex items-center gap-1 rounded-full px-2 py-1"
                    style={{ borderWidth: 2, borderStyle: 'solid', borderColor: userColor }}
                  >
                    <div className="relative">
                      <Avatar className="h-5 w-5">
                        {collab.user.avatarUrl ? (
                          <AvatarImage src={collab.user.avatarUrl} alt={collab.user.name} />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {collab.user.name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <span
                          className="ring-background absolute -right-0.5 -bottom-0.5 block h-2 w-2 animate-pulse rounded-full ring-1"
                          style={{ backgroundColor: '#22c55e' }}
                        />
                      )}
                    </div>
                    <span className="text-xs">
                      {collab.user.name || t('generated.inline.0031_unknown_bc7819b3')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="min-h-[600px]">
            <PlateEditor
              key={contentEntityId}
              value={content}
              onChange={setContent}
              documentId={contentEntityId}
              documentTitle={title}
              currentMode={mode}
              onModeChange={setMode}
              isOwnerOrCollaborator={!readOnly && isOwnerOrCollaborator}
              readOnly={readOnly}
              currentUser={
                currentUser
                  ? {
                      id: currentUser.id,
                      name: currentUser.name,
                      avatar: currentUser.avatarUrl,
                    }
                  : undefined
              }
              users={editorUsers}
              discussions={discussions}
              onDiscussionsChange={setDiscussions}
              onSuggestionAccepted={capabilities.voting ? onSuggestionAccepted : undefined}
              onSuggestionDeclined={capabilities.voting ? onSuggestionDeclined : undefined}
              onVoteAccept={capabilities.voting ? onVoteAccept : undefined}
              onVoteReject={capabilities.voting ? onVoteReject : undefined}
              onVoteAbstain={capabilities.voting ? onVoteAbstain : undefined}
              selectedCrIds={selectedCrIds}
              onSelectedCrIdsChange={setSelectedCrIds}
              remoteCursors={{
                entityId: contentEntityId,
                userId,
                userName: currentUser?.name || 'Anonymous',
                userColor,
                enabled: capabilities.presence,
                onActiveCursorsChange: setActiveCursorUserIds,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
