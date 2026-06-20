'use client';

import { useLayoutEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';

import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { PlateEditor } from '@/features/shared/ui/kit-platejs/plate-editor';
import { BadgeControl } from '@/features/shared/ui/status/StatusBadges';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/features/shared/ui/ui/card';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import {
  applyChangeRequestMotionDelays,
  shouldUpdateChangeRequestMotionForMutations,
} from '../logic/changeRequestMotion';
import type { EditorViewModel } from '../hooks/useEditorViewModel';

import { EditorHeader } from './EditorHeader';
import { InviteCollaboratorDialog } from './InviteCollaboratorDialog';
import { OnlineCollaboratorAvatars } from './OnlineCollaboratorAvatars';
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
    canManageChangeRequestVotes,
    canVoteOnChangeRequests,
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
    onFinalizeInternalVote,
    onVoteAbstain,
    onVoteAccept,
    onVoteReject,
    onlinePeerMap,
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
  const changeRequestMotionScopeRef = useRef<HTMLDivElement>(null);
  const changeRequestMotionSignatureRef = useRef<string | undefined>(undefined);
  const enableChangeRequestLoadMotion = entityType === 'amendment' || entityType === 'blog';

  useLayoutEffect(() => {
    if (!enableChangeRequestLoadMotion) {
      return;
    }

    const scope = changeRequestMotionScopeRef.current;

    if (!scope) {
      return;
    }

    changeRequestMotionSignatureRef.current = undefined;
    scope.setAttribute('data-change-request-motion-ready', 'false');
    scope.setAttribute('data-change-request-motion-complete', 'false');

    let completionTimeout: ReturnType<typeof setTimeout> | undefined;
    const completeMotion = () => {
      scope.setAttribute('data-change-request-motion-ready', 'true');
      scope.setAttribute('data-change-request-motion-complete', 'true');
      observer?.disconnect();
    };
    const scheduleCompletion = (durationMs: number) => {
      if (completionTimeout) {
        clearTimeout(completionTimeout);
      }
      completionTimeout = setTimeout(completeMotion, durationMs);
    };

    const observer =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(mutations => {
            if (!shouldUpdateChangeRequestMotionForMutations(mutations)) {
              return;
            }

            const motion = applyChangeRequestMotionDelays(
              scope,
              changeRequestMotionSignatureRef.current
            );

            if (motion.didChange) {
              changeRequestMotionSignatureRef.current = motion.signature;
              scheduleCompletion(motion.totalDurationMs);
            }
          });

    const initialMotion = applyChangeRequestMotionDelays(
      scope,
      changeRequestMotionSignatureRef.current
    );
    changeRequestMotionSignatureRef.current = initialMotion.signature;
    scope.setAttribute('data-change-request-motion-ready', 'true');
    scheduleCompletion(initialMotion.totalDurationMs);

    observer?.observe(scope, {
      attributeFilter: ['data-suggestion-id', 'data-suggestion-ids'],
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => {
      if (completionTimeout) {
        clearTimeout(completionTimeout);
      }
      observer?.disconnect();
    };
  }, [contentEntityId, enableChangeRequestLoadMotion]);

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
        <CardContent align="center" className="flex flex-col items-center justify-center py-20">
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
        <CardContent align="center" className="flex flex-col items-center justify-center py-20">
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
            <BadgeControl variant="outline" textTransform="capitalize">
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
              presenceSlot={
                <OnlineCollaboratorAvatars
                  collaborators={entity.collaborators}
                  onlinePeerMap={onlinePeerMap}
                  activeCursorUserIds={activeCursorUserIds}
                  currentUserId={userId}
                  enabled={capabilities.presence}
                />
              }
            />
          </div>
          <CardDescription>{t('features.editor.description')}</CardDescription>

          {/* Entity-specific metadata */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            {entity.metadata?.amendmentCode && (
              <BadgeControl variant="secondary" textStyle="mono">
                {entity.metadata.amendmentCode}
              </BadgeControl>
            )}
            {entity.metadata?.blogUpvotes !== undefined && (
              <span className="text-muted-foreground">
                {entity.metadata.blogUpvotes} {t('features.editor.metadata.upvotes')}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={changeRequestMotionScopeRef}
            className={cn(
              'min-h-[600px]',
              enableChangeRequestLoadMotion && 'change-request-load-motion'
            )}
            data-change-request-motion-ready={enableChangeRequestLoadMotion ? 'false' : undefined}
            data-change-request-motion-complete={
              enableChangeRequestLoadMotion ? 'false' : undefined
            }
          >
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
              onSuggestionAccepted={canManageChangeRequestVotes ? onSuggestionAccepted : undefined}
              onSuggestionDeclined={canManageChangeRequestVotes ? onSuggestionDeclined : undefined}
              onVoteAccept={canVoteOnChangeRequests ? onVoteAccept : undefined}
              onVoteReject={canVoteOnChangeRequests ? onVoteReject : undefined}
              onVoteAbstain={canVoteOnChangeRequests ? onVoteAbstain : undefined}
              onFinalizeInternalVote={
                canManageChangeRequestVotes ? onFinalizeInternalVote : undefined
              }
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
