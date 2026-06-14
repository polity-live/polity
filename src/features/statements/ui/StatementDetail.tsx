import { featureThemeClassName } from '@/features/shared/theme';
import { Link } from '@tanstack/react-router';
import { MessageSquare, Pencil, Trash2, User, Users } from 'lucide-react';

import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import type { StatementDetailModel } from '@/features/statements/hooks/useStatementDetailModel';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton';
import { CommentThread } from '@/features/shared/ui/comments';
import { ScrollableAlertDialogContent, ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { FormControlInput, FormControlLabel, FormControlTextarea } from '@/features/shared/ui/form';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { Card } from '@/features/shared/ui/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/ui/ui/alert-dialog';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { VoteButtons } from '@/features/shared/ui/voting/VoteButtons';
import { PageWrapper } from '@/layout/page-wrapper';
import { StatementMediaDisplay } from './StatementMediaDisplay';
import { StatementSurvey } from './StatementSurvey';
import { StatementTextRenderer } from './StatementTextRenderer';

interface StatementDetailProps {
  model: StatementDetailModel;
}

export function StatementDetail({ model }: StatementDetailProps) {
  if (model.status === 'loading') {
    return (
      <PageWrapper>
        <div className="py-12 text-center">
          <p className="text-muted-foreground">{model.labels.loading}</p>
        </div>
      </PageWrapper>
    );
  }

  if (model.status === 'not-found') {
    return (
      <PageWrapper>
        <div className="py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">{model.labels.notFound}</h1>
          <p className="text-muted-foreground">{model.labels.notFoundDescription}</p>
        </div>
      </PageWrapper>
    );
  }

  if (model.status === 'access-denied') {
    return (
      <PageWrapper>
        <AccessDenied />
      </PageWrapper>
    );
  }

  const {
    author,
    computedCommentCount,
    computedDownvotes,
    computedUpvotes,
    currentVoteValue,
    editDialog,
    group,
    hashtags,
    labels,
    statement,
    statementId,
    survey,
    timeDisplay,
    userId,
  } = model;

  return (
    <PageWrapper>
      <div className="mx-auto max-w-3xl">
        <Card>
          <div className="flex">
            <div className="bg-muted/30 flex flex-col items-center px-2 py-4">
              <VoteButtons
                upvotes={computedUpvotes}
                downvotes={computedDownvotes}
                userVote={currentVoteValue}
                onVote={model.onVote}
              />
            </div>

            <div className="flex-1 p-4">
              <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                {group ? (
                  <Link
                    to="/group/$id"
                    params={{ id: group.id }}
                    className="text-foreground flex items-center gap-1 font-semibold hover:underline"
                  >
                    <Avatar className="h-4 w-4 shrink-0">
                      <AvatarImage src={group.image_url ?? undefined} />
                      <AvatarFallback
                        className={featureThemeClassName(
                          'editorInviteCollaboratorDialogThemedText'
                        )}
                      >
                        <Users className="h-2.5 w-2.5" />
                      </AvatarFallback>
                    </Avatar>
                    {group.name}
                  </Link>
                ) : null}
                {group ? <span>·</span> : null}
                <span className="flex items-center gap-1">
                  <Avatar className="h-4 w-4 shrink-0">
                    <AvatarImage src={author?.avatar ?? undefined} />
                    <AvatarFallback
                      className={featureThemeClassName('editorInviteCollaboratorDialogThemedText')}
                    >
                      <User className="h-2.5 w-2.5" />
                    </AvatarFallback>
                  </Avatar>
                  {labels.authorByline}
                </span>
                {timeDisplay ? (
                  <>
                    <span>·</span>
                    <span>{timeDisplay}</span>
                  </>
                ) : null}
              </div>

              <div className="mb-3 text-lg leading-relaxed">
                <StatementTextRenderer text={statement.text ?? ''} />
              </div>

              <StatementMediaDisplay
                imageUrl={statement.image_url}
                videoUrl={statement.video_url}
                className="mb-3"
              />

              {survey ? (
                <StatementSurvey
                  survey={{
                    id: survey.id,
                    question: survey.question,
                    ends_at: survey.ends_at,
                    options: survey.options?.map(option => ({
                      id: option.id,
                      label: option.label,
                      vote_count: option.vote_count,
                      position: option.position,
                      votes: option.votes ? [...option.votes] : undefined,
                    })),
                  }}
                  userId={userId}
                  onVote={model.onSurveyVote}
                  onRetract={model.onSurveyRetract}
                  className="mb-3"
                />
              ) : null}

              {hashtags.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1">
                  {hashtags.map(tag => (
                    <Link key={tag} to="/search" search={{ hashtag: tag }}>
                      <BadgeControl
                        variant="secondary"
                        className="hover:bg-secondary/80 cursor-pointer text-xs"
                      >
                        #{tag}
                      </BadgeControl>
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="border-t pt-2">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" presentation="mutedTiny">
                    <MessageSquare className="mr-1 h-4 w-4" />
                    {computedCommentCount} {labels.comments}
                  </Button>

                  <ShareButton
                    url={`${typeof window !== 'undefined' ? window.location.origin : ''}/statement/${statementId}`}
                    title={(statement.text ?? '').substring(0, 60)}
                    variant="ghost"
                    size="sm"
                  />

                  {model.isOwner ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground text-xs"
                        onClick={model.onPrepareEdit}
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        {labels.edit}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive text-xs"
                        onClick={() => model.onDeleteOpenChange(true)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        {labels.deleteAction}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-6">
          <CommentThread
            comments={model.comments}
            currentUserId={userId}
            onAddComment={model.onAddComment}
            onVote={model.onCommentVote}
            hideHeader
          />
        </div>
      </div>

      <AlertDialog open={editDialog.deleteOpen} onOpenChange={model.onDeleteOpenChange}>
        <ScrollableAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{labels.deleteConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={model.onConfirmDelete}>
              {labels.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </ScrollableAlertDialogContent>
      </AlertDialog>

      <Dialog
        open={model.isEditOpen}
        onOpenChange={open => {
          if (!open) model.onCloseEdit();
        }}
      >
        <ScrollableDialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{labels.edit}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <FormControlLabel>{labels.formText}</FormControlLabel>
              <FormControlTextarea
                value={editDialog.editText}
                onChange={event => model.onUpdateEditText(event.target.value.slice(0, 280))}
                rows={4}
                maxLength={280}
              />
              <p className="text-muted-foreground mt-1 text-right text-xs">
                {labels.charsRemaining}
              </p>
            </div>

            <MediaUpload
              currentImage={editDialog.editImageUrl || undefined}
              onImageChange={model.onUpdateEditImageUrl}
              currentVideo={editDialog.editVideoUrl || undefined}
              onVideoChange={model.onUpdateEditVideoUrl}
              entityType="statement"
              entityId={statementId}
            />

            <VisibilityInput
              value={editDialog.editVisibility}
              onChange={model.onUpdateEditVisibility}
            />

            <div className="space-y-2 rounded-lg border p-4">
              <FormControlLabel className="text-base font-semibold">
                {labels.addSurvey}
              </FormControlLabel>
              <FormControlInput
                value={editDialog.editSurveyQuestion}
                onChange={event => model.onSurveyQuestionChange(event.target.value)}
                placeholder={labels.question}
              />
              {editDialog.editSurveyOptions.map((option, index) => (
                <FormControlInput
                  key={index}
                  value={option}
                  onChange={event => model.onSurveyOptionChange(index, event.target.value)}
                  placeholder={`${labels.option} ${index + 1}`}
                />
              ))}
              {editDialog.editSurveyOptions.length < 4 ? (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={model.onAddSurveyOption}
                >
                  + {labels.addOption}
                </Button>
              ) : null}
              <div className="space-y-2">
                <FormControlLabel>{labels.duration}</FormControlLabel>
                <FormControlInput
                  type="number"
                  min={1}
                  max={168}
                  value={editDialog.editSurveyDuration}
                  onChange={event => model.onSurveyDurationChange(Number(event.target.value))}
                />
              </div>
              {survey ? (
                <Button variant="destructive" size="sm" onClick={model.onRemoveSurvey}>
                  {labels.removeSurvey}
                </Button>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={model.onCloseEdit}>
              {labels.cancel}
            </Button>
            <Button disabled={!editDialog.editText.trim()} onClick={model.onSaveEdit}>
              {labels.save}
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>
    </PageWrapper>
  );
}
