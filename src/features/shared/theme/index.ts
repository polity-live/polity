export * from './civic';

export const FEATURE_THEME_CLASS_NAMES = {
  agendaAccreditationSectionSuccessSurface:
    'flex items-center gap-2 rounded-lg border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] p-3 text-[var(--badge-success-fg)]',
  agendaAccreditationSectionSuccessIcon: 'h-5 w-5 text-[var(--badge-success-fg)]',
  agendaAccreditationSectionSuccessText: 'font-medium text-[var(--badge-success-fg)]',
  agendaAccreditationSectionThemedText: 'text-[10px]',
  agendaAccreditationSectionSuccessIconAlpha: 'h-3 w-3 text-[var(--badge-success-fg)]',
  agendaAgendaActionBarAccentBadge:
    'animate-pulse border-fuchsia-300 text-fuchsia-700 hover:border-fuchsia-400 hover:bg-fuchsia-50 hover:text-fuchsia-800',
  agendaAgendaActionBarInfoBorder:
    'border border-[var(--badge-info-border)] px-3 text-[var(--badge-info-fg)]',
  agendaAgendaActionBarSuccessBorder:
    'border border-[var(--badge-success-border)] text-[var(--badge-success-fg)]',
  agendaAgendaActionBarSuccessBadge:
    'border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  agendaAgendaBadgesThemedText: 'font-mono text-[11px] tracking-wide uppercase',
  agendaAgendaCardSuccessGradientSurface:
    'before:animate-spin-slow relative overflow-hidden before:absolute before:inset-0 before:-z-10 before:rounded-lg before:bg-gradient-to-r before:from-green-500 before:via-emerald-500 before:to-green-500 before:p-[3px]',
  agendaAgendaElectionSectionInfoBackground: 'bg-[var(--badge-info-bg)]',
  agendaAgendaElectionSectionWarningBadge:
    'rounded-lg border border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] p-3 text-sm text-[var(--badge-warning-fg)]',
  agendaAgendaElectionSectionWarningSurface:
    'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)]',
  agendaAgendaElectionSectionWarningIcon: 'h-4 w-4 text-[var(--badge-warning-fg)]',
  agendaAgendaElectionSectionSuccessIcon: 'h-4 w-4 text-[var(--badge-success-fg)]',
  agendaAgendaItemContextCardDangerAccentGradientSurface:
    'bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/40 dark:to-pink-900/50',
  agendaAgendaItemContextCardDangerWarningGradientSurface:
    'bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/40 dark:to-red-900/50',
  agendaAgendaItemContextCardSuccessTealGradientSurface:
    'bg-gradient-to-br from-teal-100 to-emerald-100 dark:from-teal-900/40 dark:to-emerald-900/50',
  agendaAgendaItemContextCardInfoGradientSurface:
    'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/50',
  agendaAgendaItemContextCardAccentGradientSurface:
    'bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/50',
  agendaAgendaItemContextCardNeutralContrastBackground:
    'flex h-12 w-12 items-center justify-center rounded-lg bg-white/80 text-gray-700 dark:bg-gray-800/80 dark:text-gray-200',
  agendaAgendaItemContextCardNeutralContrastText: 'text-xl font-bold text-gray-900 dark:text-white',
  agendaAgendaItemContextCardNeutralText:
    'mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300',
  agendaAgendaItemContextCardNeutralContrastBadge:
    'inline-flex items-center gap-1 rounded-full border border-white/50 bg-white/70 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200',
  agendaAgendaItemContextCardNeutralContrastBadgeAlpha:
    'border-white/50 bg-white/70 text-gray-700 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200',
  agendaAgendaItemContextCardWarningSurface:
    'rounded-xl border border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] p-3 shadow-sm',
  agendaAgendaItemContextCardSuccessSurface:
    'rounded-xl border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] p-3 shadow-sm',
  agendaAgendaItemContextCardInfoSurface:
    'rounded-xl border border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] p-3 shadow-sm',
  agendaAgendaItemContextCardNeutralSurface:
    'rounded-xl border border-slate-500/20 bg-slate-500/5 p-3 shadow-sm',
  agendaAgendaItemContextCardDangerSurface:
    'rounded-xl border border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] p-3 shadow-sm',
  agendaAgendaVoteSectionSuccessBackground: 'bg-[var(--badge-success-fg)]',
  agendaAgendaVoteSectionSuccessBackgroundAlpha: 'bg-[var(--badge-success-bg)]',
  agendaAgendaVoteSectionDangerBackground: 'bg-[var(--badge-danger-fg)]',
  agendaAgendaVoteSectionDangerBackgroundAlpha: 'bg-[var(--badge-danger-bg)]',
  agendaAgendaVoteSectionNeutralBackground: 'bg-[var(--badge-neutral-fg)]',
  agendaAgendaVoteSectionNeutralBackgroundAlpha: 'bg-[var(--badge-neutral-bg)]',
  agendaAgendaVoteSectionInfoBackground: 'bg-[var(--badge-info-fg)]',
  agendaAgendaVoteSectionInfoBackgroundAlpha: 'bg-[var(--badge-info-bg)]',
  agendaAgendaVoteSectionAccentBackground: 'bg-[var(--badge-accent-fg)]',
  agendaAgendaVoteSectionAccentBackgroundAlpha: 'bg-[var(--badge-accent-bg)]',
  agendaAgendaVoteSectionWarningBackground: 'bg-[var(--badge-warning-fg)]',
  agendaAgendaVoteSectionWarningBackgroundAlpha: 'bg-[var(--badge-warning-bg)]',
  agendaChangeRequestCardsListSuccessBadge:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  agendaChangeRequestCardsListWarningBadge:
    'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]',
  agendaChangeRequestCardsListSuccessBadgeAlpha:
    'ml-0.5 border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-xs text-[var(--badge-success-fg)]',
  agendaChangeRequestTimelineCardSuccessIcon: 'h-5 w-5 text-[var(--badge-success-fg)]',
  agendaChangeRequestTimelineCardInfoLoadingIcon:
    'h-5 w-5 animate-spin text-[var(--badge-info-fg)]',
  agendaChangeRequestTimelineCardInfoRing: 'ring-2 ring-[var(--badge-info-border)]',
  agendaChangeRequestTimelineCardInfoText: 'mb-2 text-sm font-semibold text-[var(--badge-info-fg)]',
  agendaChangeRequestTimelineCardInfoPanel: 'rounded-lg bg-[var(--badge-info-bg)] p-3',
  agendaChangeRequestTimelineCardDangerText:
    'mb-1 text-sm font-semibold text-[var(--badge-danger-fg)]',
  agendaChangeRequestTimelineCardDangerPanel:
    'rounded-lg bg-[var(--badge-danger-bg)] p-3 line-through',
  agendaChangeRequestTimelineCardSuccessText:
    'mb-1 text-sm font-semibold text-[var(--badge-success-fg)]',
  agendaChangeRequestTimelineCardSuccessPanel: 'rounded-lg bg-[var(--badge-success-bg)] p-3',
  agendaChangeRequestTimelineCardSuccessBackground:
    'bg-[var(--badge-success-fg)] hover:bg-[var(--badge-success-fg)]',
  agendaEventAgendaThemedBackground:
    'bg-primary absolute -top-3 right-6 left-6 z-20 h-0.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.9)]',
  agendaEventAgendaSuccessContrastRoundIcon:
    'flex h-6 w-6 items-center justify-center rounded-full border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)] shadow-sm',
  agendaEventAgendaSuccessBorder: 'border-[var(--badge-success-border)]',
  agendaEventAgendaThemedBorder: 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]',
  agendaEventAgendaThemedBackgroundAlpha:
    'bg-primary absolute right-6 -bottom-3 left-6 z-20 h-0.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.9)]',
  agendaEventAgendaThemedPanel: 'flex w-full items-center justify-between p-0 hover:bg-transparent',
  agendaEventAgendaDangerIcon: 'h-5 w-5 text-[var(--badge-danger-fg)]',
  agendaEventAgendaThemedStyle: 'h-4 w-4 fill-current',
  agendaEventAgendaSuccessPulseDot:
    'absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-[var(--badge-success-fg)]',
  agendaEventAgendaWarningRoundIcon:
    'absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[var(--badge-warning-fg)]',
  agendaEventAgendaContrastBackground: 'relative w-full overflow-hidden rounded-lg bg-black',
  agendaEventAgendaAccentRoundIcon:
    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 md:h-10 md:w-10 dark:bg-purple-900',
  agendaEventAgendaAccentIcon: 'h-4 w-4 text-[var(--badge-accent-fg)] md:h-5 md:w-5',
  agendaEventAgendaWarningRoundIconAlpha:
    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--badge-warning-bg)] md:h-10 md:w-10',
  agendaEventAgendaWarningIcon: 'h-4 w-4 text-[var(--badge-warning-fg)] md:h-5 md:w-5',
  agendaEventAgendaInfoRoundIcon:
    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--badge-info-bg)] md:h-10 md:w-10',
  agendaEventAgendaInfoIcon: 'h-4 w-4 text-[var(--badge-info-fg)] md:h-5 md:w-5',
  agendaEventStreamSectionSuccessBackground:
    'bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  agendaEventStreamSectionInfoBackground: 'bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  agendaEventStreamSectionNeutralBackground:
    'bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]',
  agendaEventStreamSectionAccentBackground:
    'bg-[var(--badge-accent-bg)] text-[var(--badge-accent-fg)]',
  agendaEventStreamSectionWarningBackground:
    'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]',
  agendaEventStreamSectionTealBackground:
    'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  agendaEventStreamSectionSuccessContrastPulseDot:
    'absolute -top-1 -right-1 flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-[var(--badge-success-fg)] text-white',
  agendaEventStreamSectionContrastStyle: 'h-2 w-2 fill-white',
  agendaEventStreamSectionContrastBackground:
    'relative w-full overflow-hidden rounded-lg bg-black shadow-xl',
  agendaEventStreamSectionThemedPanel: 'flex items-center gap-2 p-0 hover:bg-transparent',
  agendaEventStreamSectionSuccessBackgroundAlpha: 'bg-[var(--badge-success-bg)]',
  agendaTransferAgendaItemDialogWarningSurface:
    'flex items-start gap-3 rounded-lg border border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] p-4',
  agendaTransferAgendaItemDialogWarningIcon: 'h-5 w-5 flex-shrink-0 text-[var(--badge-warning-fg)]',
  agendaTransferAgendaItemDialogWarningText: 'text-sm text-[var(--badge-warning-fg)]',
  amendmentAmendmentWikiNeutralContrastGradientSurface:
    'bg-gradient-to-br from-slate-50 via-white to-slate-100',
  amendmentAmendmentWikiSuccessTealGradientSurface:
    'bg-gradient-to-br from-emerald-50 via-white to-teal-100',
  amendmentAmendmentWikiWarningContrastGradientSurface:
    'bg-gradient-to-br from-amber-50 via-white to-orange-100',
  amendmentAmendmentWikiInfoContrastGradientSurface:
    'bg-gradient-to-br from-sky-50 via-white to-cyan-100',
  amendmentAmendmentHelpersSuccessBadge:
    'bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)] border-[var(--badge-success-border)]',
  amendmentAmendmentHelpersDangerBadge:
    'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)] border-[var(--badge-danger-border)]',
  amendmentAmendmentHelpersWarningBadge:
    'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)] border-[var(--badge-warning-border)]',
  amendmentAmendmentHelpersWarningBadgeAlpha:
    'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)] border-[var(--badge-warning-border)]',
  amendmentAmendmentHelpersInfoBadge:
    'bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)] border-[var(--badge-info-border)]',
  amendmentAmendmentHelpersNeutralBadge:
    'bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)] border-[var(--badge-neutral-border)]',
  amendmentAmendmentPathHelpersThemedGradientSurface:
    'traverses explicit holder-to-scope grants from B2 through H2 to K2 only forward',
  amendmentAmendmentEditContentWarningText: 'text-xs text-[var(--badge-warning-fg)]',
  amendmentAmendmentEditContentInfoPanel: 'rounded-lg bg-[var(--badge-info-bg)] p-4',
  amendmentAmendmentEditContentInfoText: 'text-sm font-semibold text-[var(--badge-info-fg)]',
  amendmentAmendmentEditContentInfoTextAlpha: 'mt-1 text-xs text-[var(--badge-info-fg)]',
  amendmentAmendmentForwardingPreviewAccentSurface:
    'rounded-xl border border-pink-500/25 bg-pink-500/10',
  amendmentAmendmentForwardingPreviewAccentText:
    'flex items-center gap-2 font-medium text-pink-950 dark:text-pink-100',
  amendmentAmendmentForwardingPreviewAccentIcon:
    'mt-0.5 h-4 w-4 shrink-0 text-pink-700 dark:text-pink-300',
  amendmentAmendmentPathVisualizationContrastPanel:
    'dark:bg-background rounded bg-white p-3 shadow',
  amendmentAmendmentPathVisualizationThemedSurface:
    'h-4 w-4 rounded border border-[#90caf9] bg-[#e3f2fd]',
  amendmentAmendmentPathVisualizationThemedSurfaceAlpha:
    'h-4 w-4 rounded border border-[#a5d6a7] bg-[#c8e6c9]',
  amendmentAmendmentPathVisualizationThemedSurfaceBeta:
    'h-4 w-4 rounded border border-[#ef9a9a] bg-[#ffcdd2]',
  featureThemeWarningSurface:
    'mb-4 border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)]',
  featureThemeWarningIcon: 'h-5 w-5 text-[var(--badge-warning-fg)]',
  featureThemeWarningText: 'text-[var(--badge-warning-fg)]',
  featureThemeWarningTextAlpha: 'mb-3 text-sm text-[var(--badge-warning-fg)]',
  featureThemeNeutralContrastSurface:
    'flex items-center justify-between gap-2 rounded-md border bg-white p-2 dark:bg-gray-900',
  featureThemeSuccessBackground:
    'h-8 w-8 text-[var(--badge-success-fg)] hover:bg-[var(--badge-success-bg)] hover:text-[var(--badge-success-fg)]',
  featureThemeDangerBackground:
    'h-8 w-8 text-[var(--badge-danger-fg)] hover:bg-[var(--badge-danger-bg)] hover:text-[var(--badge-danger-fg)]',
  assistantAriaKaiStepInfoAccentGradientSurface:
    'bg-gradient-to-br from-purple-500 to-blue-500 text-2xl text-white',
  assistantAriaKaiStepAccentIcon: 'mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--badge-accent-fg)]',
  assistantAriaKaiStepInfoIcon: 'mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--badge-info-fg)]',
  authAuthGuardInfoLoadingIcon: 'h-8 w-8 animate-spin text-[var(--badge-info-fg)]',
  authGroupSearchStepSuccessGradientSurface:
    'rounded-full bg-gradient-to-br from-green-500 to-emerald-600 p-4',
  authGroupSearchStepContrastIcon: 'h-8 w-8 text-white',
  authGroupSearchStepSuccessNeutralBorder:
    'border-[var(--badge-success-border)] ring-2 ring-[var(--badge-success-border)] ring-offset-2 dark:ring-offset-gray-900',
  authGroupSearchStepSuccessPanel: 'rounded-full bg-[var(--badge-success-fg)] p-1',
  authGroupSearchStepSuccessContrastIcon: 'h-3 w-3 text-white',
  authMembershipConfirmStepAccentGradientSurface:
    'rounded-full bg-gradient-to-br from-purple-500 to-violet-600 p-4',
  authMembershipConfirmStepSuccessBadge:
    'rounded-lg border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] p-4 text-center',
  authMembershipConfirmStepSuccessPanel: 'rounded-full bg-[var(--badge-success-fg)] p-2',
  authMembershipConfirmStepContrastIcon: 'h-5 w-5 text-white',
  authMembershipConfirmStepSuccessText: 'font-medium text-[var(--badge-success-fg)]',
  authNameStepInfoAccentGradientSurface:
    'rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-4',
  authNameStepSuccessText: 'text-[var(--badge-success-fg)]',
  authSummaryStepWarningGradientSurface:
    'rounded-full bg-gradient-to-br from-amber-500 to-orange-600 p-4',
  authSummaryStepContrastIcon: 'h-4 w-4 text-white',
  authSummaryStepSuccessText: 'text-sm text-[var(--badge-success-fg)]',
  authSummaryStepSuccessTextAlpha: 'font-semibold text-[var(--badge-success-fg)]',
  authSummaryStepInfoPanel: 'rounded-full bg-[var(--badge-info-fg)] p-2',
  authSummaryStepInfoText: 'text-sm text-[var(--badge-info-fg)]',
  authSummaryStepInfoTextAlpha: 'font-semibold text-[var(--badge-info-fg)]',
  authSummaryStepInfoIcon: 'h-5 w-5 text-[var(--badge-info-fg)]',
  authSummaryStepNeutralPanel: 'rounded-full bg-[var(--badge-neutral-fg)] p-2',
  authSummaryStepNeutralText: 'text-sm text-[var(--badge-neutral-fg)]',
  authSummaryStepAccentPanel: 'rounded-full bg-[var(--badge-accent-fg)] p-2',
  authSummaryStepAccentText: 'text-sm text-[var(--badge-accent-fg)]',
  authSummaryStepAccentTextAlpha: 'font-semibold text-[var(--badge-accent-fg)]',
  authSummaryStepAccentIcon: 'h-5 w-5 text-[var(--badge-accent-fg)]',
  authAccessDeniedDangerRoundIcon:
    'mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--badge-danger-bg)]',
  authAccessDeniedDangerIcon: 'h-10 w-10 text-[var(--badge-danger-fg)]',
  authForgotPasswordFormSuccessIcon: 'h-12 w-12 text-[var(--badge-success-fg)]',
  authForgotPasswordFormInfoIcon: 'h-12 w-12 text-[var(--badge-info-fg)]',
  authSignInFormContrastBadge:
    'mt-4 w-full border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed] dark:hover:bg-[#303134]',
  createUseCreateGroupFormSuccessIcon: 'h-4 w-4 text-[var(--badge-success-fg)]',
  createUseCreateGroupFormSuccessText:
    'text-xs tracking-wide text-[var(--badge-success-fg)] uppercase',
  createUseCreateGroupFormSuccessBadge:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)] hover:bg-[var(--badge-success-bg)]',
  createUseCreateGroupFormDangerText:
    'text-xs tracking-wide text-[var(--badge-danger-fg)] uppercase',
  createUseCreateGroupFormDangerBadge:
    'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)] hover:bg-[var(--badge-danger-bg)]',
  createUseCreateGroupFormWarningText:
    'text-xs tracking-wide text-[var(--badge-warning-fg)] uppercase',
  createUseCreateGroupFormWarningSurface:
    'rounded-md border border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] p-3',
  createUseCreateGroupFormWarningTextAlpha: 'text-sm font-medium text-[var(--badge-warning-fg)]',
  createUseCreateGroupFormWarningTextBeta: 'text-xs text-[var(--badge-warning-fg)]',
  createUseCreateGroupFormWarningBadge:
    'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)] hover:bg-[var(--badge-warning-bg)]',
  createCreateFieldsSuccessRing: 'focus-visible:ring-[var(--badge-success-border)]',
  createCreateFieldsThemedBorder:
    'border-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
  createCreateFieldsSuccessBorder:
    'border-[var(--badge-success-border)] focus-visible:ring-[var(--badge-success-border)]',
  createCreateFieldsThemedBorderAlpha:
    '[&_[data-slot=input]]:border-destructive [&_[data-slot=input]]:focus-visible:ring-destructive/20 dark:[&_[data-slot=input]]:focus-visible:ring-destructive/40 [&_[data-slot=typeahead-selected]]:border-destructive [&_[data-slot=typeahead-selected-list]]:border-destructive',
  createCreateFieldsSuccessBorderAlpha:
    '[&_[data-slot=input]]:border-[var(--badge-success-border)] [&_[data-slot=input]]:focus-visible:ring-[var(--badge-success-border)] [&_[data-slot=typeahead-selected]]:border-[var(--badge-success-border)]',
  createCreateFieldsThemedBorderBeta:
    '[&_[data-slot=input]]:border-destructive [&_[data-slot=input]]:focus-visible:ring-destructive/20 dark:[&_[data-slot=input]]:focus-visible:ring-destructive/40 [&_[data-slot=typeahead-selected]]:border-destructive',
  createCreateProgressIndicatorThemedRoundIcon:
    'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
  decisionterminalDecisionStatusSuccessText: 'text-[var(--badge-success-fg)]',
  decisionterminalDecisionStatusWarningText: 'text-[var(--badge-warning-fg)]',
  decisionterminalDecisionStatusWarningTextAlpha: 'text-[var(--badge-warning-fg)]',
  decisionterminalDecisionStatusDangerText: 'text-[var(--badge-danger-fg)] animate-pulse',
  decisionterminalDecisionStatusDangerTextAlpha: 'text-[var(--badge-danger-fg)]',
  decisionterminalDecisionStatusNeutralText: 'text-[var(--badge-neutral-fg)]',
  decisionterminalCountdownTimerWarningText: 'text-[var(--badge-warning-fg)]',
  decisionterminalCountdownTimerThemedText:
    'text-muted-foreground text-[9px] tracking-[1px] uppercase',
  decisionterminalDecisionRowThemedText:
    'text-muted-foreground mt-0.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px]',
  decisionterminalDecisionRowThemedTextAlpha: 'font-mono text-[11px] font-medium',
  decisionterminalDecisionRowThemedTextBeta:
    'text-muted-foreground truncate font-mono text-[10px] tracking-[0.8px] uppercase',
  decisionterminalDecisionRowThemedTextGamma:
    'text-muted-foreground shrink-0 font-mono text-[9px] uppercase',
  decisionterminalDecisionRowThemedTextDelta:
    'text-muted-foreground shrink-0 font-mono text-[10px]',
  decisionterminalDecisionSummaryInfoText: 'text-[var(--badge-info-fg)]',
  decisionterminalDecisionSummaryNeutralBorder:
    'border-b border-gray-200 last:border-b-0 dark:border-gray-700',
  decisionterminalDecisionSummaryNeutralPanel:
    'h-auto w-full justify-between rounded-none p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
  decisionterminalDecisionSummaryNeutralIcon: 'h-4 w-4 text-[var(--badge-neutral-fg)]',
  decisionterminalDecisionSummaryNeutralText: 'px-3 pb-3 text-sm text-[var(--badge-neutral-fg)]',
  decisionterminalDecisionSummaryNeutralBorderAlpha:
    'rounded-lg border border-gray-200 dark:border-gray-700',
  decisionterminalDecisionSummaryNeutralSurface:
    'flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50',
  decisionterminalDecisionSummaryNeutralTextAlpha:
    'text-xs font-medium tracking-wide text-[var(--badge-neutral-fg)] uppercase',
  decisionterminalDecisionSummaryNeutralTextBeta: 'text-[var(--badge-neutral-fg)] transition-all',
  decisionterminalDecisionTableThemedText:
    'text-muted-foreground font-mono text-[10px] font-semibold tracking-[1px] uppercase',
  decisionterminalDecisionTerminalNeutralSurface:
    'bg-card flex h-full min-h-[640px] flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700',
  decisionterminalDecisionWidgetContentThemedText:
    'text-muted-foreground mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px]',
  decisionterminalDecisionWidgetContentThemedTextAlpha:
    'text-muted-foreground mt-1 font-mono text-[11px]',
  decisionterminalDecisionWidgetContentThemedTextBeta:
    'text-muted-foreground shrink-0 font-mono text-[11px]',
  decisionterminalDecisionWidgetContentThemedTextGamma:
    'text-muted-foreground mt-0.5 font-mono text-[11px]',
  decisionterminalDecisionWidgetContentSuccessBackground: 'bg-[var(--badge-success-fg)]',
  decisionterminalDecisionWidgetContentWarningBackground: 'bg-[var(--badge-warning-fg)]',
  decisionterminalDecisionWidgetContentThemedTextDelta:
    'text-muted-foreground mt-0.5 flex items-center gap-2 font-mono text-[11px]',
  decisionterminalDecisionWidgetContentThemedTextEpsilon:
    'text-muted-foreground truncate text-[11px]',
  decisionterminalFlashRowSuccessShadow: 'shadow-[color:var(--badge-success-border)]',
  decisionterminalFlashRowDangerShadow: 'shadow-[color:var(--badge-danger-border)]',
  decisionterminalFlashRowWarningShadow: 'shadow-[color:var(--badge-warning-border)]',
  decisionterminalFlashRowSuccessBackground: 'bg-[var(--badge-success-bg)]',
  decisionterminalFlashRowDangerBackground: 'bg-[var(--badge-danger-bg)]',
  decisionterminalFlashRowWarningBackground: 'bg-[var(--badge-warning-bg)]',
  decisionterminalFlashRowWarningBackgroundAlpha: 'bg-[var(--badge-warning-fg)]',
  decisionterminalMobileDecisionCardThemedText: 'text-muted-foreground mr-2 font-mono text-[10px]',
  decisionterminalMobileDecisionCardThemedTextAlpha:
    'text-muted-foreground mt-0.5 truncate font-mono text-[10px] tracking-[1px] uppercase',
  decisionterminalTerminalHeaderNeutralBorder: 'border-b border-[var(--badge-neutral-border)]',
  decisionterminalTerminalHeaderDangerText: 'animate-pulse text-[var(--badge-danger-fg)]',
  decisionterminalTerminalHeaderDangerTextAlpha: 'font-medium text-[var(--badge-danger-fg)]',
  decisionterminalTrendIndicatorSuccessBackground: 'bg-[var(--badge-success-bg)]',
  decisionterminalTrendIndicatorWarningBackground: 'bg-[var(--badge-warning-bg)]',
  delegateDelegatesOverviewWarningSurface:
    'flex items-center gap-2 rounded-lg border border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] p-3',
  delegateDelegatesOverviewWarningIcon: 'h-4 w-4 text-[var(--badge-warning-fg)]',
  delegateDelegatesOverviewWarningText: 'text-sm text-[var(--badge-warning-fg)]',
  delegateDelegatesOverviewSuccessSurface:
    'flex items-center gap-3 rounded-lg border bg-[var(--badge-success-bg)] p-3',
  delegateDelegatesOverviewInfoSurface:
    'flex items-center gap-3 rounded-lg border bg-[var(--badge-info-bg)] p-3',
  discussionsCommentTreeWarningText: 'text-[var(--badge-warning-fg)]',
  discussionsCommentTreeInfoText: 'text-[var(--badge-info-fg)]',
  docsDocsTopicsThemedGradientSurface: 'jump-to-target',
  documentUseAutoSaveThemedStyle: 'Auto-save failed:',
  documentPresenceIndicatorsContrastText: 'text-xs text-white',
  editorEditorHeaderWarningText: 'text-[var(--badge-warning-fg)]',
  editorInviteCollaboratorDialogThemedText: 'text-[8px]',
  editorInviteCollaboratorDialogThemedPanel: 'h-4 w-4 p-0 hover:bg-transparent',
  eventCompactCalendarEventStylesSuccessBackground:
    'bg-[var(--badge-success-bg)] hover:bg-[var(--badge-success-bg)]',
  eventCompactCalendarEventStylesInfoSurface:
    'border border-dashed border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] hover:bg-[var(--badge-info-bg)]',
  eventCompactCalendarEventStylesWarningBorder:
    'border border-[var(--badge-warning-border)] text-[var(--badge-warning-fg)] shadow-sm hover:opacity-90',
  eventCompactCalendarEventStylesWarningText: 'text-[var(--badge-warning-fg)]',
  eventSharedMonthThemedText:
    'cursor-pointer rounded px-1 py-0.5 text-[11px] leading-tight transition-all',
  eventSharedWeekViewNeutralText:
    'text-muted-foreground absolute top-0 right-2 -translate-y-1/2 text-[11px] font-medium',
  eventSharedWeekViewThemedText: 'text-muted-foreground mb-2 text-[10px] font-medium',
  eventCancelEventDialogInfoIcon: 'h-4 w-4 text-[var(--badge-info-fg)]',
  eventCancelEventDialogAccentIcon: 'h-4 w-4 text-[var(--badge-accent-fg)]',
  eventEventEditSuccessBadge:
    'rounded-xl border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] p-4 text-sm',
  eventEventStreamSuccessContrastPulseDot:
    'absolute -top-1 -right-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-[var(--badge-success-fg)] text-white',
  eventEventStreamContrastStyle: 'h-3 w-3 fill-white',
  eventEventTimeSeriesSectionInfoBadge:
    'rounded-xl border border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] px-4 py-3 text-sm',
  eventEventTimeSeriesSectionWarningBadge:
    'rounded-xl border border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] px-4 py-3 text-sm',
  fileuploadImageUploadThemedText:
    'text-muted-foreground flex w-full items-center gap-3 text-[11px] font-medium tracking-[0.24em] uppercase',
  floweditorFlowEditorContrastPanel: 'rounded bg-white p-4 shadow',
  floweditorFlowEditorNeutralText: 'mb-3 text-sm text-[var(--badge-neutral-fg)]',
  floweditorFlowEditorContrastPanelAlpha: 'w-80 rounded bg-white p-4 shadow',
  floweditorUseFlowEditorThemedStyle: '0 0 0 2px #ff0072',
  floweditorUseFlowEditorThemedStyleAlpha: '1px dashed #aaa',
  groupAddRoleDialogSuccessSurface:
    'rounded-2xl border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] p-4',
  groupAddRoleDialogSuccessBorder:
    'border-[var(--badge-success-border)] text-[var(--badge-success-fg)]',
  groupAssignHolderDialogInfoBadge:
    'rounded-lg border border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] p-3 text-sm text-[var(--badge-info-fg)]',
  groupAssignHolderDialogWarningSurface:
    'rounded-lg border border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] p-3',
  groupGroupConflictPanelWarningSurface:
    'space-y-3 rounded-lg border border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] p-4',
  groupGroupConflictPanelWarningIcon: 'mt-0.5 h-4 w-4 shrink-0 text-[var(--badge-warning-fg)]',
  groupMembershipRightsAlignmentPanelSuccessBackground:
    'bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  groupMembershipRightsAlignmentPanelWarningBackground:
    'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]',
  groupMembershipRightsAlignmentPanelInfoBackground:
    'bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  groupMembershipRightsAlignmentPanelDangerBackground:
    'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
  groupOpenAssignmentsPanelSuccessBadge:
    'flex items-center gap-2 rounded-lg border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] px-3 py-2 text-sm text-[var(--badge-success-fg)]',
  groupOpenAssignmentsPanelThemedBorder:
    'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]',
  groupOpenAssignmentsPanelThemedBorderAlpha: 'border-transparent',
  groupPaymentsSectionSuccessText: 'text-xl font-semibold text-[var(--badge-success-fg)]',
  groupPaymentsSectionDangerText: 'text-xl font-semibold text-[var(--badge-danger-fg)]',
  groupRolesPermissionsTableThemedText: 'pointer-events-none text-[11px]',
  groupRoleTagContrastBorder: 'border-0 text-white shadow-sm shadow-black/10 dark:text-white',
  meetMeetingCalendarViewsSuccessBorder: 'border-[var(--badge-success-border)]',
  meetMeetingCalendarViewsInfoBorder: 'border-dashed border-[var(--badge-info-border)]',
  meetMeetingCalendarViewsThemedBackground: 'cursor-default hover:bg-transparent',
  messageAiContextCardsInfoIcon: 'h-5 w-5 text-[var(--badge-info-fg)]',
  messageAiContextCardsInfoBadge:
    'inline-flex items-center gap-1.5 rounded-md border border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] px-3 py-1.5 text-xs font-medium text-[var(--badge-info-fg)] transition-colors hover:bg-[var(--badge-info-bg)]',
  messageAiContextCardsThemedGradientSurface: 'overflow-hidden rounded-2xl bg-gradient-to-br',
  messageAiContextCardsThemedBorder:
    'flex items-center gap-1.5 border-b px-3 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase',
  messageAiContextCardsSuccessBadge:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  messageAiContextCardsInfoBadgeAlpha:
    'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  messageAiContextCardsSuccessText:
    'mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-[var(--badge-success-fg)] uppercase',
  messageAssistantMessageInputNeutralGradientSurface:
    'bg-gradient-to-br from-slate-200/80 via-slate-200/60 to-slate-100/40 text-slate-700 dark:bg-slate-700/20 dark:text-slate-200',
  messageAssistantMessageInputWarningGradientSurface:
    'bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-yellow-400/20 text-amber-700 dark:text-amber-200',
  messageAssistantMessageInputAccentGradientSurface:
    'bg-gradient-to-br from-fuchsia-500/20 via-purple-500/20 to-indigo-500/20 text-fuchsia-700 dark:text-fuchsia-200',
  messageAssistantMessageInputThemedText:
    'text-muted-foreground px-2 pt-1 text-[11px] font-semibold tracking-[0.14em] uppercase',
  messageAssistantMessageInputSuccessRoundIcon:
    'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[var(--badge-success-bg)] text-[11px] font-bold leading-none text-[var(--badge-success-fg)]',
  messageAssistantMessageInputWarningRoundIcon:
    'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[var(--badge-warning-bg)] text-[11px] font-bold leading-none text-[var(--badge-warning-fg)]',
  messageAssistantMessageInputSuccessRoundIconAlpha:
    'inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--badge-success-bg)] text-[11px] font-bold leading-none text-[var(--badge-success-fg)]',
  messageAssistantMessageInputWarningRoundIconAlpha:
    'inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--badge-warning-bg)] text-[11px] font-bold leading-none text-[var(--badge-warning-fg)]',
  messageAssistantMessageInputNeutralText: 'text-xs font-medium text-[var(--badge-neutral-fg)]',
  messageAssistantMessageInputNeutralBorder: 'border-t border-[var(--badge-neutral-border)]',
  messageConversationListContrastRing:
    'opacity-100 shadow-sm ring-1 ring-black/10 dark:ring-white/15',
  messageLinkPreviewInfoIcon: 'h-5 w-5 text-[var(--badge-info-fg)]',
  messageLinkPreviewAccentIcon: 'h-5 w-5 text-[var(--badge-accent-fg)]',
  messageLinkPreviewWarningIcon: 'h-5 w-5 text-[var(--badge-warning-fg)]',
  messageLinkPreviewAccentIconAlpha: 'h-5 w-5 text-pink-500',
  messageLinkPreviewInfoIconAlpha: 'h-5 w-5 text-cyan-500',
  messageLinkPreviewAccentIconBeta: 'h-5 w-5 text-indigo-500',
  messageMessageBubbleDangerBadge:
    'border border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
  messageMessageBubbleDangerText: 'text-[var(--badge-danger-fg)] opacity-70',
  messageMessageListDangerBadge:
    'flex items-start gap-2 rounded-md border border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] px-3 py-2 text-sm text-[var(--badge-danger-fg)]',
  messageMessageListThemedText:
    'text-muted-foreground mb-1 text-[11px] font-medium tracking-[0.18em] uppercase',
  messageMessageListDangerText: 'flex items-start gap-2 text-sm text-[var(--badge-danger-fg)]',
  navigationNavItemListLayout:
    'grid w-full auto-rows-max grid-cols-2 gap-8 p-4 sm:grid-cols-3 md:grid-cols-4',
  navigationNavItemsUnauthenticatedThemedStyle: '/#features',
  navigationUserMenuDangerText: 'text-[var(--badge-danger-fg)] focus:text-[var(--badge-danger-fg)]',
  networkUseGroupNetworkFlowThemedStyle: '0 0 0 2px #ff0072, 0 0 0 5px rgba(16, 185, 129, 0.35)',
  networkUseGroupNetworkFlowThemedStyleAlpha: '0 0 0 4px rgba(16, 185, 129, 0.35)',
  networkUseGroupNetworkFlowNeutralBorder: 'my-1 border-[var(--badge-neutral-border)]',
  networkUseGroupNetworkFlowNeutralSurface:
    'relative h-3 w-6 rounded-sm border border-gray-300 bg-gray-100',
  networkUseManageNetworkTabSuccessTealGradientSurface:
    'border-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90',
  networkUseManageNetworkTabInfoAccentGradientSurface:
    'border-0 bg-gradient-to-r from-sky-500 to-violet-500 text-white hover:opacity-90',
  networkUseManageNetworkTabWarningAccentGradientSurface:
    'border-0 bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white hover:opacity-90',
  networkUseManageWorkflowsTabWarningSurface:
    'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)]',
  networkUseManageWorkflowsTabSuccessSurface:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)]',
  networkUseUserNetworkFlowThemedStyle: '3px solid #2196f3',
  networkUseUserNetworkFlowThemedRoundIcon:
    'h-4 w-4 rounded-full border-2 border-[#2196f3] bg-[#e3f2fd]',
  networkGroupConnectionComposerThemedGradientSurface:
    'stores mutual rights as two holder-to-scope grants',
  networkGroupConnectionDerivedThemedGradientSurface:
    'creates one structure row and holder-to-scope grant rows for active connections',
  networkNetworkEdgeHelpersThemedGradientSurface: 'edge-parent-h1-to-b1',
  networkNetworkEdgeHelpersThemedGradientSurfaceAlpha: 'edge-b1-to-h1',
  networkNetworkEdgeHelpersThemedGradientSurfaceBeta: 'edge-h1-to-f1',
  networkNetworkRelationshipHelpersDangerGradientSurface:
    'traverses right-filtered graphs only in holder-to-scope direction',
  networkAmendmentPathVisualizationThemedText:
    'text-[11px] font-semibold tracking-[0.18em] uppercase opacity-75',
  networkAmendmentPathVisualizationContrastBadge:
    'inline-flex items-center gap-2 rounded-full border border-current/15 bg-white/70 px-3 py-1 text-[11px] font-medium dark:bg-black/10',
  networkAmendmentPathVisualizationContrastPanel:
    'h-auto w-full items-start justify-between p-0 text-left whitespace-normal hover:bg-transparent',
  networkEventNetworkFlowThemedStyle: '3px solid #66bb6a',
  networkEventNetworkFlowThemedSurface: 'h-4 w-4 rounded border-2 border-[#66bb6a] bg-[#e8f5e9]',
  networkGroupConnectionComposerThemedText: 'text-muted-foreground text-[11px]',
  networkGroupConnectionStatusCellSuccessText: 'inline-flex text-[var(--badge-success-fg)]',
  networkGroupRelationshipFieldsDangerWarningGradientSurface:
    'from-amber-600 via-orange-500 to-rose-500 decoration-orange-400/90',
  networkGroupRelationshipFieldsInfoAccentGradientSurface:
    'from-cyan-600 via-sky-500 to-violet-500 decoration-sky-400/90',
  networkGroupRelationshipFieldsWarningAccentGradientSurface:
    'from-fuchsia-600 via-violet-500 to-amber-500 decoration-fuchsia-400/90',
  networkGroupRelationshipFieldsSuccessInfoGradientSurface:
    'border-0 bg-gradient-to-r from-emerald-100 via-teal-50 to-cyan-100 text-emerald-900',
  networkGroupRelationshipFieldsSuccessInfoGradientSurfaceAlpha:
    'dark:from-emerald-950 dark:via-teal-950 dark:to-cyan-950 dark:text-emerald-200',
  networkGroupRelationshipFieldsSuccessInfoGradientSurfaceBeta:
    'hover:from-emerald-100 hover:via-teal-50 hover:to-cyan-100 hover:text-emerald-900',
  networkGroupRelationshipFieldsSuccessInfoGradientSurfaceGamma:
    'dark:hover:from-emerald-950 dark:hover:via-teal-950 dark:hover:to-cyan-950 dark:hover:text-emerald-200',
  networkGroupRelationshipFieldsInfoAccentGradientSurfaceAlpha:
    'border-0 bg-gradient-to-r from-sky-100 via-blue-50 to-indigo-100 text-sky-900',
  networkGroupRelationshipFieldsInfoAccentGradientSurfaceBeta:
    'dark:from-sky-950 dark:via-blue-950 dark:to-indigo-950 dark:text-sky-200',
  networkGroupRelationshipFieldsInfoAccentGradientSurfaceGamma:
    'hover:from-sky-100 hover:via-blue-50 hover:to-indigo-100 hover:text-sky-900',
  networkGroupRelationshipFieldsInfoAccentGradientSurfaceDelta:
    'dark:hover:from-sky-950 dark:hover:via-blue-950 dark:hover:to-indigo-950 dark:hover:text-sky-200',
  networkGroupRelationshipFieldsThemedGradientSurface:
    'inline-block bg-gradient-to-r bg-clip-text text-xs font-semibold text-transparent underline decoration-2 underline-offset-4',
  networkGroupRelationshipFieldsInfoGradientSurface:
    'from-blue-700 via-sky-600 to-cyan-600 decoration-sky-500/90',
  networkGroupRelationshipFieldsDangerWarningGradientSurfaceAlpha:
    'from-amber-700 via-orange-600 to-rose-600 decoration-orange-500/90',
  networkGroupRelationshipFieldsDangerAccentGradientSurface:
    'from-fuchsia-700 via-pink-600 to-rose-600 decoration-fuchsia-500/90',
  networkGroupRelationshipFieldsSuccessInfoGradientSurfaceDelta:
    'from-emerald-700 via-teal-600 to-cyan-600 decoration-emerald-500/90',
  networkGroupRelationshipFieldsInfoAccentGradientSurfaceEpsilon:
    'from-violet-700 via-indigo-600 to-blue-600 decoration-violet-500/90',
  networkGroupRelationshipFieldsContrastBorder: 'border-0 text-white shadow-sm',
  networkGroupRelationshipFieldsContrastPanel:
    'h-auto w-full items-start justify-start p-0 text-left whitespace-normal hover:bg-transparent disabled:opacity-100',
  networkGroupRelationshipFieldsContrastBadge: 'border-white/70 bg-white/15 text-white',
  networkGroupRelationshipFieldsContrastText: 'text-white/90',
  networkGroupRelationshipFieldsContrastSurface: 'border-white/30 bg-white/10',
  networkGroupRelationshipFieldsContrastBadgeAlpha:
    'h-auto min-h-10 border-white/25 bg-white/15 py-2 text-left shadow-none',
  networkGroupRelationshipFieldsContrastTextAlpha:
    'text-white data-[placeholder]:text-white/70 [&>svg]:text-white/80',
  networkHierarchyConflictDialogSuccessBadge:
    'flex items-center gap-2 rounded-md border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] px-3 py-2 text-sm',
  networkHierarchyConflictDialogSuccessIcon: 'h-4 w-4 shrink-0 text-[var(--badge-success-fg)]',
  networkNetworkControlPanelNeutralContrastBadge:
    'border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200 hover:text-slate-950 dark:border-white/70 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:hover:text-white',
  networkNetworkControlPanelSuccessBadge:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)] hover:bg-[var(--badge-success-bg)] hover:text-[var(--badge-success-fg)]',
  networkNetworkControlPanelInfoBadge:
    'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)] hover:bg-[var(--badge-info-bg)] hover:text-[var(--badge-info-fg)]',
  networkNetworkControlPanelWarningBadge:
    'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)] hover:bg-[var(--badge-warning-bg)] hover:text-[var(--badge-warning-fg)]',
  networkNetworkControlPanelAccentBadge:
    'border-[var(--badge-accent-border)] bg-[var(--badge-accent-bg)] text-[var(--badge-accent-fg)] hover:bg-[var(--badge-accent-bg)] hover:text-[var(--badge-accent-fg)]',
  networkNetworkControlPanelThemedSurface:
    'border-border/70 bg-background/95 dark:bg-card/95 rounded-lg border p-2 shadow-sm',
  networkNetworkControlPanelThemedBadge:
    'border-border bg-background/90 text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-card/90 dark:text-foreground',
  networkNetworkControlPanelThemedSurfaceAlpha:
    'border-border/80 bg-background/95 dark:bg-background/95 flex max-h-[calc(100%-1rem)] w-[calc(100%-1rem)] max-w-sm flex-col overflow-hidden rounded border p-4 shadow-lg supports-[backdrop-filter]:backdrop-blur-sm',
  networkNetworkControlPanelNeutralText: 'mb-3 text-sm text-[var(--badge-neutral-fg)]',
  networkNetworkControlPanelInfoPanel:
    'mt-3 shrink-0 rounded-md bg-[var(--badge-info-bg)] p-2 text-sm',
  networkNetworkControlPanelInfoText: 'text-[var(--badge-info-fg)]',
  networkNetworkControlPanelThemedSurfaceBeta:
    'border-border/70 bg-background/95 dark:bg-card/95 mt-3 flex min-h-0 flex-1 flex-col rounded-lg border p-3 shadow-sm',
  networkNetworkControlPanelNeutralSurface:
    'h-4 w-4 rounded border-2 border-solid border-gray-400 bg-gray-100',
  networkNetworkControlPanelNeutralSurfaceAlpha:
    'h-4 w-4 rounded border-2 border-dashed border-gray-400 bg-gray-100',
  networkNetworkControlPanelThemedSurfaceGamma:
    'h-4 w-4 rounded border-2 border-[#fbbf24] bg-[#fff8e1]',
  networkNetworkEntityDialogSuccessBadge:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  networkNetworkEntityDialogInfoBadge:
    'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  networkNetworkEntityDialogWarningBadge:
    'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]',
  networkRightFiltersThemedSurface:
    'border-border/70 bg-background/95 dark:bg-card/95 mt-4 rounded-lg border p-3 shadow-sm',
  networkWorkflowFlowVisualizationThemedSurface:
    'h-4 w-4 rounded border border-[#90caf9] bg-[#bbdefb]',
  networkWorkflowFlowVisualizationThemedSurfaceAlpha:
    'h-4 w-4 rounded border border-[#ffcc80] bg-[#ffe0b2]',
  networkWorkflowFlowVisualizationSuccessIcon: 'h-4 w-4 text-[var(--badge-success-fg)]',
  networkWorkflowFlowVisualizationWarningIcon: 'h-4 w-4 text-[var(--badge-warning-fg)]',
  networkWorkflowEditorThemedGradientSurface:
    'offers next workflow-step targets only in holder-to-scope grant direction',
  notificationNotificationItemInfoRing:
    'h-5 w-5 hover:ring-1 hover:ring-[var(--badge-info-border)]',
  notificationNotificationItemInfoContrastBackground:
    'bg-[var(--badge-info-fg)] text-[10px] text-white',
  notificationNotificationAccentText: 'text-[var(--badge-accent-fg)]',
  notificationNotificationSuccessText: 'text-[var(--badge-success-fg)]',
  notificationNotificationAccentTextAlpha: 'text-pink-500',
  notificationNotificationAccentTextBeta: 'text-indigo-500',
  notificationNotificationInfoText: 'text-[var(--badge-info-fg)]',
  notificationNotificationDangerText: 'text-[var(--badge-danger-fg)]',
  notificationNotificationInfoTextAlpha: 'text-[var(--badge-info-fg)]',
  notificationNotificationNeutralText: 'text-[var(--badge-neutral-fg)]',
  notificationNotificationWarningText: 'text-[var(--badge-warning-fg)]',
  notificationNotificationWarningTextAlpha: 'text-[var(--badge-warning-fg)]',
  notificationNotificationInfoTextBeta: 'text-[var(--badge-info-fg)]',
  notificationNotificationSuccessTextAlpha: 'text-[var(--badge-success-fg)]',
  notificationNotificationAccentTextGamma: 'text-[var(--badge-accent-fg)]',
  notificationNotificationAccentTextDelta: 'text-[var(--badge-accent-fg)]',
  notificationNotificationAccentTextEpsilon: 'text-indigo-400',
  notificationNotificationAccentTextZeta: 'text-[var(--badge-accent-fg)]',
  notificationNotificationWarningTextBeta: 'text-[var(--badge-warning-fg)]',
  notificationNotificationDangerTextAlpha: 'text-[var(--badge-danger-fg)]',
  notificationNotificationDangerTextBeta: 'text-[var(--badge-danger-fg)]',
  paymentSubscriptionPlansGridSuccessSurface:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] shadow-[var(--shadow-card)]',
  paymentSubscriptionPlansGridSuccessPanel:
    'rounded-full border border-[var(--badge-success-border)] bg-[var(--surface-overlay)] px-2 py-0.5 text-xs font-medium text-[var(--badge-success-fg)] shadow-sm',
  paymentSubscriptionStatusDangerIcon: 'h-4 w-4 text-[var(--badge-danger-fg)]',
  positionPositionsTableWarningIcon: 'h-4 w-4 text-[var(--badge-warning-fg)]',
  positionPositionsTableWarningText: 'mt-2 block font-semibold text-[var(--badge-warning-fg)]',
  pqlPqlFilterBuilderDialogSuccessBorder:
    'border-[var(--badge-success-border)] focus-visible:ring-[var(--badge-success-border)]',
  pqlPqlQueryEditorThemedText: 'min-w-16 justify-center text-[10px] uppercase',
  pqlPqlToolbarThemedPanel: 'h-4 w-4 p-0 text-inherit hover:bg-transparent',
  pqlPqlToolbarContrastPanel:
    'h-auto flex-1 justify-start p-0 text-left whitespace-normal hover:bg-transparent',
  publiclandingLandingNetworkPreviewThemedStyle: '2px solid #0f766e',
  publiclandingLandingNetworkPreviewThemedStyleAlpha: '0 10px 24px rgba(15, 118, 110, 0.16)',
  publiclandingPublicLandingPageNeutralBackground:
    'flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-950 ring-1 ring-zinc-950/10',
  publiclandingPublicLandingPageThemedStyle: '#features',
  publiclandingPublicLandingPageThemedStyleAlpha: 'hsl(var(--background) / 0.62)',
  publiclandingPublicLandingPageTealSurface: 'h-4 w-4 rounded border-2 border-teal-700 bg-teal-100',
  searchSearchResultCardNeutralContrastBadge:
    'text-muted-foreground rounded-md border bg-white/70 px-2 py-0.5 text-xs dark:bg-gray-900/60',
  searchStatementSearchCardThemedText:
    'text-muted-foreground mt-1.5 flex items-center gap-2 text-[11px]',
  timelineContentTypeConfigSuccessInfoGradientSurface: 'from-green-100 to-blue-100',
  timelineContentTypeConfigSuccessInfoGradientSurfaceAlpha:
    'dark:from-green-900/40 dark:to-blue-900/50',
  timelineContentTypeConfigSuccessBorder: 'border-[var(--badge-success-border)]',
  timelineContentTypeConfigWarningGradientSurface: 'from-orange-100 to-yellow-100',
  timelineContentTypeConfigWarningGradientSurfaceAlpha:
    'dark:from-orange-900/40 dark:to-yellow-900/50',
  timelineContentTypeConfigWarningBorder: 'border-[var(--badge-warning-border)]',
  timelineContentTypeConfigInfoAccentGradientSurface: 'from-cyan-100 via-sky-100 to-indigo-100',
  timelineContentTypeConfigInfoAccentGradientSurfaceAlpha:
    'dark:from-cyan-900/40 dark:via-sky-900/40 dark:to-indigo-900/50',
  timelineContentTypeConfigInfoText: 'text-[var(--badge-info-fg)]',
  timelineContentTypeConfigInfoBorder: 'border-[var(--badge-info-border)]',
  timelineContentTypeConfigInfoAccentGradientSurfaceBeta: 'from-purple-100 to-blue-100',
  timelineContentTypeConfigInfoAccentGradientSurfaceGamma:
    'dark:from-purple-900/40 dark:to-blue-900/50',
  timelineContentTypeConfigAccentText: 'text-[var(--badge-accent-fg)]',
  timelineContentTypeConfigAccentBorder: 'border-[var(--badge-accent-border)]',
  timelineContentTypeConfigInfoGradientSurface: 'from-sky-100 to-cyan-100',
  timelineContentTypeConfigInfoGradientSurfaceAlpha: 'dark:from-sky-900/40 dark:to-cyan-900/50',
  timelineContentTypeConfigDangerWarningGradientSurface: 'from-red-100 to-orange-100',
  timelineContentTypeConfigDangerWarningGradientSurfaceAlpha:
    'dark:from-red-900/40 dark:to-orange-900/50',
  timelineContentTypeConfigDangerBorder: 'border-[var(--badge-danger-border)]',
  timelineContentTypeConfigDangerAccentGradientSurface: 'from-rose-100 to-pink-100',
  timelineContentTypeConfigDangerAccentGradientSurfaceAlpha:
    'dark:from-rose-900/40 dark:to-pink-900/50',
  timelineContentTypeConfigDangerText: 'text-[var(--badge-danger-fg)]',
  timelineContentTypeConfigDangerBorderAlpha: 'border-[var(--badge-danger-border)]',
  timelineContentTypeConfigDangerAccentGradientSurfaceBeta: 'from-pink-100 to-red-100',
  timelineContentTypeConfigDangerAccentGradientSurfaceGamma:
    'dark:from-pink-900/40 dark:to-red-900/50',
  timelineContentTypeConfigInfoGradientSurfaceBeta: 'from-cyan-100 to-blue-100',
  timelineContentTypeConfigInfoGradientSurfaceGamma: 'dark:from-cyan-900/40 dark:to-blue-900/50',
  timelineContentTypeConfigInfoTextAlpha: 'text-[var(--badge-info-fg)]',
  timelineContentTypeConfigAccentGradientSurface: 'from-indigo-100 to-purple-100',
  timelineContentTypeConfigAccentGradientSurfaceAlpha:
    'dark:from-indigo-900/40 dark:to-purple-900/50',
  timelineContentTypeConfigAccentTextAlpha: 'text-[var(--badge-accent-fg)]',
  timelineContentTypeConfigAccentBorderAlpha: 'border-[var(--badge-accent-border)]',
  timelineContentTypeConfigSuccessGradientSurface: 'from-lime-100 to-emerald-100',
  timelineContentTypeConfigSuccessGradientSurfaceAlpha:
    'dark:from-lime-900/40 dark:to-emerald-900/50',
  timelineContentTypeConfigThemedText: 'text-[var(--badge-success-fg)]',
  timelineContentTypeConfigThemedBorder: 'border-[var(--badge-success-border)]',
  timelineContentTypeConfigSuccessTealGradientSurface: 'from-teal-100 to-green-100',
  timelineContentTypeConfigSuccessTealGradientSurfaceAlpha:
    'dark:from-teal-900/40 dark:to-green-900/50',
  timelineContentTypeConfigTealText: 'text-[var(--badge-success-fg)]',
  timelineContentTypeConfigTealBorder: 'border-[var(--badge-success-border)]',
  timelineContentTypeConfigSuccessTealGradientSurfaceBeta: 'from-emerald-100 to-teal-100',
  timelineContentTypeConfigSuccessTealGradientSurfaceGamma:
    'dark:from-emerald-900/40 dark:to-teal-900/50',
  timelineContentTypeConfigSuccessText: 'text-[var(--badge-success-fg)]',
  timelineContentTypeConfigNeutralGradientSurface: 'from-gray-100 to-slate-100',
  timelineContentTypeConfigNeutralGradientSurfaceAlpha:
    'dark:from-gray-900/40 dark:to-slate-900/50',
  timelineContentTypeConfigNeutralText: 'text-[var(--badge-neutral-fg)]',
  timelineContentTypeConfigNeutralBorder: 'border-[var(--badge-neutral-border)]',
  timelineContentTypeConfigDangerAccentGradientSurfaceDelta: 'from-fuchsia-100 to-rose-100',
  timelineContentTypeConfigDangerAccentGradientSurfaceEpsilon:
    'dark:from-fuchsia-900/40 dark:to-rose-900/50',
  timelineContentTypeConfigAccentTextBeta: 'text-[var(--badge-accent-fg)]',
  timelineContentTypeConfigAccentBorderBeta: 'border-[var(--badge-accent-border)]',
  timelineContentTypeConfigInfoAccentGradientSurfaceDelta: 'from-blue-100 to-indigo-100',
  timelineContentTypeConfigInfoAccentGradientSurfaceEpsilon:
    'dark:from-blue-900/40 dark:to-indigo-900/50',
  timelineContentTypeConfigInfoBorderAlpha: 'border-[var(--badge-info-border)]',
  timelineUseSwipeGesturesNeutralBackground: 'bg-[var(--badge-neutral-fg)]',
  timelineUseTodoTimelineCardDangerText: 'text-[var(--badge-danger-fg)]',
  timelineUseTodoTimelineCardDangerBackground: 'bg-[var(--badge-danger-bg)]',
  timelineUseTodoTimelineCardWarningText: 'text-[var(--badge-warning-fg)]',
  timelineUseTodoTimelineCardWarningBackground: 'bg-[var(--badge-warning-bg)]',
  timelineUseTodoTimelineCardWarningBackgroundAlpha: 'bg-[var(--badge-warning-bg)]',
  timelineUseTodoTimelineCardSuccessText: 'text-[var(--badge-success-fg)]',
  timelineUseTodoTimelineCardSuccessBackground: 'bg-[var(--badge-success-bg)]',
  timelineGradientAssignmentInfoAccentGradientSurface:
    'bg-gradient-to-br from-pink-100 to-blue-100 dark:from-pink-900/40 dark:to-blue-900/50',
  timelineGradientAssignmentWarningGradientSurface:
    'bg-gradient-to-br from-coral-100 to-peach-100 dark:from-orange-900/40 dark:to-amber-900/50',
  timelineGradientAssignmentWarningGradientSurfaceAlpha:
    'bg-gradient-to-br from-orange-100 to-yellow-100 dark:from-orange-900/40 dark:to-yellow-900/50',
  timelineGradientAssignmentDangerAccentGradientSurface:
    'bg-gradient-to-br from-red-100 to-pink-100 dark:from-red-900/40 dark:to-pink-900/50',
  timelineGradientAssignmentInfoAccentGradientSurfaceAlpha:
    'bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/50',
  timelineGradientAssignmentInfoTealGradientSurface:
    'bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/40 dark:to-cyan-900/50',
  timelineGradientAssignmentSuccessGradientSurface:
    'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/50',
  timelineGradientAssignmentSuccessTealGradientSurface:
    'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/50',
  timelineGradientAssignmentNeutralGradientSurface:
    'bg-gradient-to-br from-gray-100 to-slate-100 dark:from-gray-900/40 dark:to-slate-900/50',
  timelineGradientAssignmentWarningNeutralGradientSurface:
    'bg-gradient-to-br from-amber-100 to-stone-100 dark:from-amber-900/40 dark:to-stone-900/50',
  timelineGradientAssignmentAccentNeutralGradientSurface:
    'bg-gradient-to-br from-indigo-100 to-slate-100 dark:from-indigo-900/40 dark:to-slate-900/50',
  timelineGradientAssignmentAccentGradientSurface:
    'bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/40 dark:to-fuchsia-900/50',
  timelineGradientAssignmentSuccessGradientSurfaceAlpha:
    'bg-gradient-to-br from-lime-100 to-green-100 dark:from-lime-900/40 dark:to-green-900/50',
  timelineGradientAssignmentInfoAccentGradientSurfaceBeta:
    'bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-sky-900/40 dark:to-indigo-900/50',
  timelineGradientAssignmentDangerWarningGradientSurface:
    'bg-gradient-to-br from-rose-100 to-amber-100 dark:from-rose-900/40 dark:to-amber-900/50',
  timelineGradientAssignmentDangerAccentGradientSurfaceAlpha:
    'bg-gradient-to-r from-pink-500 to-rose-400 dark:from-pink-700 dark:to-rose-600',
  timelineGradientAssignmentAccentGradientSurfaceAlpha:
    'bg-gradient-to-r from-violet-500 to-purple-400 dark:from-violet-700 dark:to-purple-600',
  timelineGradientAssignmentInfoGradientSurface:
    'bg-gradient-to-r from-blue-500 to-cyan-400 dark:from-blue-700 dark:to-cyan-600',
  timelineGradientAssignmentSuccessTealGradientSurfaceAlpha:
    'bg-gradient-to-r from-teal-500 to-emerald-400 dark:from-teal-700 dark:to-emerald-600',
  timelineGradientAssignmentSuccessGradientSurfaceBeta:
    'bg-gradient-to-r from-green-500 to-lime-400 dark:from-green-700 dark:to-lime-600',
  timelineGradientAssignmentWarningGradientSurfaceBeta:
    'bg-gradient-to-r from-amber-500 to-yellow-400 dark:from-amber-700 dark:to-yellow-600',
  timelineGradientAssignmentDangerWarningGradientSurfaceAlpha:
    'bg-gradient-to-r from-orange-500 to-red-400 dark:from-orange-700 dark:to-red-600',
  timelineGradientAssignmentAccentGradientSurfaceBeta:
    'bg-gradient-to-r from-fuchsia-500 to-pink-400 dark:from-fuchsia-700 dark:to-pink-600',
  timelineGradientAssignmentInfoAccentGradientSurfaceGamma:
    'bg-gradient-to-r from-indigo-500 to-blue-400 dark:from-indigo-700 dark:to-blue-600',
  timelineGradientAssignmentInfoTealGradientSurfaceAlpha:
    'bg-gradient-to-r from-cyan-500 to-teal-400 dark:from-cyan-700 dark:to-teal-600',
  timelineGradientAssignmentSuccessGradientSurfaceGamma:
    'bg-gradient-to-r from-emerald-500 to-green-400 dark:from-emerald-700 dark:to-green-600',
  timelineGradientAssignmentDangerWarningGradientSurfaceBeta:
    'bg-gradient-to-r from-rose-500 to-orange-400 dark:from-rose-700 dark:to-orange-600',
  timelineGradientAssignmentInfoAccentGradientSurfaceDelta:
    'bg-gradient-to-r from-sky-500 to-indigo-400 dark:from-sky-700 dark:to-indigo-600',
  timelineGradientAssignmentSuccessGradientSurfaceDelta:
    'bg-gradient-to-r from-lime-500 to-emerald-400 dark:from-lime-700 dark:to-emerald-600',
  timelineGradientAssignmentDangerAccentGradientSurfaceBeta:
    'bg-gradient-to-r from-red-500 to-pink-400 dark:from-red-700 dark:to-pink-600',
  timelineActionBarAccentText: 'text-pink-600 dark:text-pink-400',
  timelineActionBarThemedStyle: 'fill-current',
  timelineActionBarNeutralText: 'flex items-center gap-3 text-[var(--badge-neutral-fg)]',
  timelineActionBarAccentPanel:
    'h-auto gap-1 p-0 transition-colors hover:bg-transparent hover:text-pink-500',
  timelineActionBarInfoPanel:
    'h-auto gap-1 p-0 transition-colors hover:bg-transparent hover:text-blue-500',
  timelineActionTimelineCardAccentBackground: 'bg-[var(--badge-accent-bg)]',
  timelineActionTimelineCardAccentText: 'text-[var(--badge-accent-fg)]',
  timelineActionTimelineCardInfoBackground: 'bg-[var(--badge-info-bg)]',
  timelineActionTimelineCardSuccessBackground: 'bg-[var(--badge-success-bg)]',
  timelineActionTimelineCardDangerBackground: 'bg-[var(--badge-danger-bg)]',
  timelineActionTimelineCardWarningBackground: 'bg-[var(--badge-warning-bg)]',
  timelineActionTimelineCardNeutralBackground: 'bg-[var(--badge-neutral-bg)] text-xs',
  timelineActionTimelineCardNeutralRoundIcon:
    'border-background flex h-8 w-8 items-center justify-center rounded-full border-2 bg-gray-100 text-xs font-medium dark:bg-gray-800',
  timelineActionTimelineCardNeutralPanel:
    'inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700',
  timelineAmendmentTimelineCardSuccessIcon: 'h-3.5 w-3.5 text-[var(--badge-success-fg)]',
  timelineAmendmentTimelineCardDangerIcon: 'h-3.5 w-3.5 text-[var(--badge-danger-fg)]',
  timelineBlogTimelineCardContrastGradientSurface:
    'absolute inset-0 bg-gradient-to-t from-black/50 to-transparent',
  timelineBlogTimelineCardContrastText: 'line-clamp-2 text-lg leading-tight font-bold text-white',
  timelineBlogTimelineCardTealIcon: 'mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600 dark:text-teal-400',
  timelineElectionTimelineCardNeutralBackground: 'bg-[var(--badge-neutral-bg)]',
  timelineElectionTimelineCardDangerBackground: 'bg-[var(--badge-danger-fg)]',
  timelineElectionTimelineCardDangerBackgroundAlpha: 'bg-[var(--badge-danger-fg)]',
  timelineElectionTimelineCardNeutralBackgroundAlpha: 'bg-[var(--badge-neutral-bg)]',
  timelineElectionTimelineCardWarningRing: 'ring-2 ring-[var(--badge-warning-border)]',
  timelineElectionTimelineCardDangerBackgroundBeta: 'bg-[var(--badge-danger-bg)] text-xs',
  timelineElectionTimelineCardWarningNeutralIcon:
    'absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 text-[var(--badge-warning-fg)]',
  timelineElectionTimelineCardNeutralRoundIcon:
    'border-background flex h-10 w-10 items-center justify-center rounded-full border-2 bg-gray-100 text-xs font-medium dark:bg-gray-800',
  timelineElectionTimelineCardWarningBorder:
    'h-16 w-16 border-4 border-[var(--badge-warning-border)] ring-2 ring-[var(--badge-warning-border)]',
  timelineElectionTimelineCardDangerBackgroundGamma: 'bg-[var(--badge-danger-bg)] text-lg',
  timelineElectionTimelineCardWarningNeutralIconAlpha:
    'absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 text-[var(--badge-warning-fg)]',
  timelineElectionTimelineCardWarningText:
    'mt-1 text-sm font-medium text-[var(--badge-warning-fg)]',
  timelineEventTimelineCardContrastPulseDot: 'mr-1.5 h-2 w-2 animate-pulse rounded-full bg-white',
  timelineEventTimelineCardNeutralContrastPanel:
    'flex flex-col items-center rounded-xl bg-white/80 px-4 py-2 shadow-sm dark:bg-gray-900/80',
  timelineEventTimelineCardNeutralContrastSurface: 'border bg-white/70 dark:bg-gray-900/60',
  timelineImageTimelineCardContrastGradientSurface:
    'absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4',
  timelineImageTimelineCardContrastIcon: 'mt-0.5 h-4 w-4 flex-shrink-0 text-white/80',
  timelineImageTimelineCardContrastText: 'line-clamp-2 text-sm text-white',
  timelineImageTimelineCardContrastTextAlpha: 'flex items-center gap-1 text-xs text-white/80',
  timelineImageTimelineCardNeutralContrastBackground:
    'absolute top-2 left-2 bg-white/80 text-xs dark:bg-gray-900/80',
  timelinePaymentTimelineCardDangerText: 'text-[var(--badge-danger-fg)]',
  timelinePaymentTimelineCardSuccessBackground:
    'bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  timelinePaymentTimelineCardDangerBackground:
    'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
  timelineQuickCommentThemedPanel:
    'text-muted-foreground hover:text-foreground h-auto gap-1.5 p-0 text-sm transition-colors hover:bg-transparent',
  timelineReasonDisplayWarningBackground: 'bg-[var(--badge-warning-bg)]',
  timelineReasonDisplayInfoBackground: 'bg-[var(--badge-info-bg)]',
  timelineReasonDisplayNeutralText: 'text-[var(--badge-neutral-fg)]',
  timelineReasonDisplayNeutralBackground: 'bg-[var(--badge-neutral-bg)]',
  timelineStatementTimelineCardContrastBackground:
    'h-32 w-full overflow-hidden rounded-xl bg-black/10',
  timelineStatementTimelineCardAccentIcon: 'h-8 w-8 text-indigo-200',
  timelineStatementTimelineCardContrastText:
    'flex items-center justify-between text-xs text-white/90',
  timelineStatementTimelineCardContrastBackgroundAlpha:
    'h-1.5 overflow-hidden rounded-full bg-white/15',
  timelineStatementTimelineCardContrastBackgroundBeta:
    'h-full rounded-full bg-white/50 transition-all',
  timelineStatementTimelineCardContrastTextAlpha: 'text-center text-xs text-white/60',
  timelineTimelineCardBaseNeutralBorder:
    'flex min-h-0 flex-col overflow-hidden border border-gray-100 dark:border-gray-800',
  timelineTodoTimelineCardNeutralContrastBadge:
    'text-foreground h-auto gap-2 rounded-full border-white/70 bg-white/80 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-gray-700/70 dark:bg-gray-950/70 dark:text-gray-100 dark:hover:bg-gray-950',
  timelineTodoTimelineCardSuccessIcon: 'h-4 w-4 text-[var(--badge-success-fg)]',
  timelineTopicPillSuccessText: 'text-[var(--badge-success-fg)]',
  timelineTopicPillSuccessBorder: 'border-[var(--badge-success-border)]',
  timelineTopicPillInfoBorder: 'border-[var(--badge-info-border)]',
  timelineTopicPillWarningText: 'text-[var(--badge-warning-fg)]',
  timelineTopicPillWarningBorder: 'border-[var(--badge-warning-border)]',
  timelineTopicPillWarningTextAlpha: 'text-[var(--badge-warning-fg)]',
  timelineTopicPillWarningBorderAlpha: 'border-[var(--badge-warning-border)]',
  timelineTopicPillAccentText: 'text-[var(--badge-accent-fg)]',
  timelineTopicPillAccentBorder: 'border-[var(--badge-accent-border)]',
  timelineTopicPillDangerText: 'text-[var(--badge-danger-fg)]',
  timelineTopicPillDangerBorder: 'border-[var(--badge-danger-border)]',
  timelineTopicPillTealBackground: 'bg-teal-100 dark:bg-teal-900/40',
  timelineTopicPillTealText: 'text-teal-700 dark:text-teal-300',
  timelineTopicPillTealBorder: 'border-teal-200 dark:border-teal-800',
  timelineTopicPillNeutralBackground: 'bg-[var(--badge-neutral-bg)]',
  timelineTopicPillNeutralText: 'text-[var(--badge-neutral-fg)]',
  timelineTopicPillNeutralBorder: 'border-[var(--badge-neutral-border)]',
  timelineUserTimelineCardInfoAccentGradientSurface:
    'bg-gradient-to-br from-blue-500 to-purple-500 text-white',
  timelineVideoTimelineCardDangerAccentGradientSurface:
    'flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-100 to-red-100 dark:from-pink-900/40 dark:to-red-900/50',
  timelineVideoTimelineCardContrastBackground:
    'absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100',
  timelineVideoTimelineCardContrastPanel:
    'transform rounded-full bg-white/90 p-4 shadow-lg transition-transform group-hover:scale-110',
  timelineVideoTimelineCardNeutralIcon:
    'h-8 w-8 fill-[var(--badge-neutral-fg)] text-[var(--badge-neutral-fg)]',
  timelineVideoTimelineCardContrastBackgroundAlpha:
    'absolute right-2 bottom-2 bg-black/80 font-mono text-xs text-white',
  timelineVideoTimelineCardContrastBackgroundBeta:
    'aspect-video w-full overflow-hidden rounded-lg bg-black',
  timelineVoteTimelineCardNeutralText: 'text-[var(--badge-neutral-fg)]',
  timelineVoteTimelineCardDangerRing: 'ring-opacity-50 ring-2 ring-[var(--badge-danger-border)]',
  timelineVoteTimelineCardDangerBackground: 'animate-pulse bg-[var(--badge-danger-fg)]',
  timelineVoteTimelineCardInfoIcon: 'h-3 w-3 text-[var(--badge-info-fg)]',
  timelineVoteTimelineCardInfoIconAlpha: 'h-3 w-3 text-[var(--badge-info-fg)]',
  timelineVoteTimelineCardInfoIconBeta: 'h-3 w-3 text-[var(--badge-info-fg)]',
  timelineVoteTimelineCardSuccessIcon: 'h-3 w-3 text-[var(--badge-success-fg)]',
  timelineVoteTimelineCardDangerIcon: 'h-3 w-3 text-[var(--badge-danger-fg)]',
  featureThemeThemedBorder:
    'display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #ffffff;box-shadow:0 10px 24px rgba(15,23,42,0.26);',
  timelineCivicTimelineMapNeutralText: 'text-[11px] text-[var(--badge-neutral-fg)]',
  timelineCivicTimelineRailDangerBackground: 'bg-[var(--badge-danger-fg)]',
  timelineCivicTimelineRailInfoBackground: 'bg-[var(--badge-info-fg)]',
  timelineCivicTimelineRailSuccessBackground: 'bg-[var(--badge-success-fg)]',
  timelineTimelineModeToggleNeutralBackground:
    'bg-slate-900 text-slate-50 data-[state=on]:bg-slate-900 data-[state=on]:text-slate-50 dark:bg-slate-100 dark:text-slate-900 dark:data-[state=on]:bg-slate-100 dark:data-[state=on]:text-slate-900',
  timelineTimelineModeToggleNeutralBackgroundAlpha: 'hover:bg-[var(--badge-neutral-bg)]',
  timelineTimelineModeToggleDangerRoundIcon:
    'absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--badge-danger-fg)] opacity-75',
  timelineTimelineModeToggleDangerRoundIconAlpha:
    'relative inline-flex h-2 w-2 rounded-full bg-[var(--badge-danger-fg)]',
  timelineGradientAssignmentThemedGradientSurface: 'bg-gradient-to-br',
  timelineGradientAssignmentThemedGradientSurfaceAlpha: 'from-',
  timelineGradientAssignmentThemedGradientSurfaceBeta: 'to-',
  timelineGradientAssignmentThemedStyle: 'dark:',
  timelineGradientAssignmentThemedGradientSurfaceGamma: 'bg-gradient',
  todoUseKanbanBoardNeutralContrastSurface:
    'border border-slate-200 bg-white dark:border-slate-800 dark:bg-black',
  userBadgeColorsInfoText: 'text-[var(--badge-info-fg)]',
  userBadgeColorsSuccessText: 'text-[var(--badge-success-fg)]',
  userBadgeColorsAccentText: 'text-[var(--badge-accent-fg)]',
  userBadgeColorsWarningText: 'text-[var(--badge-warning-fg)]',
  userBadgeColorsDangerText: 'text-[var(--badge-danger-fg)]',
  userBadgeColorsAccentBackground: 'bg-indigo-100 dark:bg-indigo-900/40',
  userBadgeColorsAccentTextAlpha: 'text-indigo-800 dark:text-indigo-300',
  userBadgeColorsTealText: 'text-teal-800 dark:text-teal-300',
  userGradientColorsWarningGradientSurface:
    'bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/40 dark:to-orange-900/50',
  userGradientColorsSuccessInfoGradientSurface:
    'bg-gradient-to-br from-green-100 to-blue-100 dark:from-green-900/40 dark:to-blue-900/50',
  userGradientColorsAccentGradientSurface:
    'bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/50',
  userGradientColorsDangerWarningGradientSurface:
    'bg-gradient-to-br from-red-100 to-yellow-100 dark:from-red-900/40 dark:to-yellow-900/50',
  userGradientColorsSuccessTealGradientSurface:
    'bg-gradient-to-br from-teal-100 to-green-100 dark:from-teal-900/40 dark:to-green-900/50',
  userAiSettingsTabDangerBorder:
    'border-[var(--badge-danger-border)] focus-visible:ring-[var(--badge-danger-border)]',
  userAiSettingsTabSuccessBorder:
    'border-[var(--badge-success-border)] focus-visible:ring-[var(--badge-success-border)]',
  userSocialBarInfoText:
    'text-cyan-600 transition-transform duration-200 hover:scale-110 hover:text-cyan-700',
  userSocialBarDangerText:
    'text-red-600 transition-transform duration-200 hover:scale-110 hover:text-red-700',
  userSocialBarInfoTextAlpha:
    'text-sky-700 transition-transform duration-200 hover:scale-110 hover:text-sky-800',
  userSocialBarSuccessText:
    'text-[var(--badge-success-fg)] transition-transform duration-200 hover:scale-110 hover:text-[var(--badge-success-fg)]',
  userSocialBarAccentText:
    'text-pink-500 transition-transform duration-200 hover:scale-110 hover:text-pink-600',
  userSocialBarNeutralText:
    'text-gray-800 transition-transform duration-200 hover:scale-110 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-400',
  userSocialBarInfoTextBeta:
    'text-blue-600 transition-transform duration-200 hover:scale-110 hover:text-blue-700',
  userSocialBarWarningText:
    'text-yellow-400 transition-transform duration-200 hover:scale-110 hover:text-yellow-500',
  userSocialBarNeutralTextAlpha:
    'text-zinc-900 transition-transform duration-200 hover:scale-110 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300',
  featureThemeInfoBackground: 'bg-[var(--badge-info-bg)]',
  featureThemeInfoText: 'text-[var(--badge-info-fg)]',
  userUserWikiSuccessGradientSurface:
    'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/50',
  userUserWikiSuccessContrastBackground:
    'bg-[var(--badge-success-fg)] text-white hover:bg-[var(--badge-success-fg)]',
  userUserWikiDangerGradientSurface:
    'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/40 dark:to-rose-900/50',
  userUserWikiDangerText: 'text-[var(--badge-danger-fg)]',
  userUserWikiContrastText: 'text-white',
  userUserWikiInfoAccentGradientSurface:
    'bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/50',
  userUserWikiNeutralGradientSurface:
    'bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900/40 dark:to-slate-900/50',
  userUserWikiNeutralText: 'text-[var(--badge-neutral-fg)]',
  userUserWikiNeutralBackground: 'bg-[var(--badge-neutral-bg)]',
  votecastVoteResultSentenceWarningText:
    'font-semibold text-[var(--badge-warning-fg)] underline underline-offset-4 hover:text-[var(--badge-warning-fg)]',
  votecastVoteResultSentenceWarningTextAlpha: 'font-semibold text-[var(--badge-warning-fg)]',
  votecastVoteResultSentenceWarningPanel:
    'flex items-center gap-2 rounded-lg bg-[var(--badge-warning-bg)] px-4 py-3 text-sm',
  votecastVoteResultSentenceWarningIcon: 'h-5 w-5 shrink-0 text-[var(--badge-warning-fg)]',
  votecastVoteResultSentenceSuccessBackground:
    'bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  votecastVoteResultSentenceDangerBackground:
    'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
  votecastVoteResultSentenceWarningBackground:
    'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]',
  voteAmendmentVotingQueueInfoSurface:
    'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)]',
  voteAmendmentVotingQueueNeutralSurface:
    'border-[var(--badge-neutral-border)] bg-[var(--badge-neutral-bg)]',
  voteAmendmentVotingQueueNeutralBorder: 'border-[var(--badge-neutral-border)]',
  voteAmendmentVotingQueueNeutralText: 'text-sm font-semibold text-[var(--badge-neutral-fg)]',
  voteAmendmentVotingQueueDangerIcon: 'h-4 w-4 text-[var(--badge-danger-fg)]',
  voteAmendmentVotingQueueNeutralIcon: 'h-4 w-4 text-[var(--badge-neutral-fg)]',
  voteAmendmentVotingQueueSuccessBadge:
    'flex-1 border-[var(--badge-success-border)] text-[var(--badge-success-fg)] hover:bg-[var(--badge-success-bg)]',
  voteAmendmentVotingQueueDangerBadge:
    'flex-1 border-[var(--badge-danger-border)] text-[var(--badge-danger-fg)] hover:bg-[var(--badge-danger-bg)]',
  voteAmendmentVotingQueueSuccessSurface:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)]',
  voteAmendmentVotingQueueNeutralBorderAlpha: 'border-[var(--badge-neutral-border)]',
  voteVoteControlsSuccessBackground:
    'flex-1 bg-[var(--badge-success-fg)] hover:bg-[var(--badge-success-fg)]',
  voteVoteControlsNeutralBackground:
    'h-2 overflow-hidden rounded-full bg-[var(--badge-neutral-bg)]',
  voteVoteControlsSuccessBackgroundAlpha: 'h-full bg-[var(--badge-success-fg)] transition-all',
  voteVoteControlsDangerBackground: 'h-full bg-[var(--badge-danger-fg)] transition-all',
  voteVoteControlsNeutralIcon: 'h-3 w-3 text-[var(--badge-neutral-fg)]',
  voteVoteControlsNeutralBackgroundAlpha: 'h-full bg-[var(--badge-neutral-fg)] transition-all',
  voteVoteControlsSuccessBorder:
    'border-[var(--badge-success-border)] text-[var(--badge-success-fg)]',
  voteVoteControlsDangerBorder: 'border-[var(--badge-danger-border)] text-[var(--badge-danger-fg)]',
  voteVoteControlsNeutralBorder:
    'border-[var(--badge-neutral-border)] text-[var(--badge-neutral-fg)]',
  voteVotingPhaseIndicatorInfoBackground: 'bg-[var(--badge-info-fg)]',
  voteVotingPhaseIndicatorSuccessBackground: 'bg-[var(--badge-success-bg)]',
  voteVotingPhaseIndicatorDangerBackground: 'bg-[var(--badge-danger-bg)]',
  voteVotingPhaseIndicatorWarningText: 'text-[var(--badge-warning-fg)]',
  voteVotingPhaseIndicatorWarningBackground: 'bg-[var(--badge-warning-bg)]',
  voteVotingPhaseIndicatorSuccessText: 'text-2xl font-bold text-[var(--badge-success-fg)]',
  voteVotingPhaseIndicatorDangerText: 'text-2xl font-bold text-[var(--badge-danger-fg)]',
  voteVotingPhaseIndicatorNeutralText: 'text-2xl font-bold text-[var(--badge-neutral-fg)]',
  voteVotingPhaseIndicatorDangerBackgroundAlpha:
    'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
  voteVotingSessionManagerWarningIcon: 'h-5 w-5 text-[var(--badge-warning-fg)]',
  voteVotingSessionManagerSuccessPanel: 'rounded bg-[var(--badge-success-bg)] p-2',
  voteVotingSessionManagerSuccessText: 'text-2xl font-bold text-[var(--badge-success-fg)]',
  voteVotingSessionManagerDangerPanel: 'rounded bg-[var(--badge-danger-bg)] p-2',
  voteVotingSessionManagerDangerText: 'text-2xl font-bold text-[var(--badge-danger-fg)]',
  voteVotingSessionManagerNeutralPanel: 'rounded bg-[var(--badge-neutral-bg)] p-2',
  voteVotingSessionManagerNeutralText: 'text-2xl font-bold text-[var(--badge-neutral-fg)]',
  messageAiContextCardsSuccessTealGradientSurface:
    'via-background/80 border border-emerald-500/20 from-emerald-500/10 to-teal-500/10',
  messageAiContextCardsInfoGradientSurface:
    'via-background/80 border border-sky-500/20 from-sky-500/10 to-cyan-500/10',
  messageAiContextCardsSuccessGradientSurface:
    'via-background overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-lime-500/10',
  editorEditingModeSelectorContrastText: 'mt-0.5 rounded p-1 text-white',
  editorEditingModeSelectorThemedRing: 'ring-2 ring-offset-2',
  groupChangeRoleDialogThemedGradientSurface:
    'border-border/70 from-background via-background to-muted/30 overflow-hidden rounded-2xl border bg-gradient-to-br',
  groupMemberRightsDialogThemedGradientSurface:
    'border-border/70 from-background via-background to-muted/30 rounded-2xl border bg-gradient-to-br p-4',
  groupActiveMembersTableThemedGradientSurface:
    'border-border/70 from-background to-muted/20 mb-6 bg-gradient-to-b',
  groupMembershipRightsAlignmentPanelThemedGradientSurface:
    'border-border/70 from-background to-muted/20 bg-gradient-to-b',
  groupAddRoleDialogSuccessSurfaceAlpha:
    'bg-muted/20 rounded-2xl border border-[var(--badge-success-border)] p-4',
  networkUseGroupNetworkFlowInfoContrastRoundIcon:
    'border-background absolute -top-1.5 -right-1.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-[var(--badge-info-fg)] text-white shadow-sm',
  networkUseGroupNetworkFlowWarningContrastRoundIcon:
    'border-background absolute -top-1.5 -right-1.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-[var(--badge-warning-fg)] text-white shadow-sm',
  timelineVoteTimelineCardInfoProgressFill: 'h-2 opacity-60 [&>div]:bg-[var(--badge-info-fg)]',
  timelineTodoTimelineCardSuccessProgressFill: '[&>div]:bg-[var(--badge-success-fg)]',
  timelineVoteTimelineCardDangerProgressFill: '[&>div]:bg-[var(--badge-danger-fg)]',
  timelineAmendmentTimelineCardNeutralContrastSurface: 'border bg-white/70 dark:bg-gray-900/60',
  timelineContentTypeConfigThemedGradientSurface: 'bg-gradient-to-br',
} as const;

export type FeatureThemeClassName = keyof typeof FEATURE_THEME_CLASS_NAMES;

export function featureThemeClassName(key: FeatureThemeClassName): string {
  return FEATURE_THEME_CLASS_NAMES[key];
}

export const FEATURE_THEME_VALUES = {
  amendmentAmendmentPathVisualizationDangerColor: '#ffcdd2',
  amendmentAmendmentPathVisualizationThemeValue: '#e3f2fd',
  amendmentAmendmentPathVisualizationSuccessColor: '#c8e6c9',
  amendmentAmendmentPathVisualizationNeutralColor: '#333',
  amendmentAmendmentPathVisualizationDangerColorAlpha: '#ef9a9a',
  amendmentAmendmentPathVisualizationInfoColor: '#90caf9',
  amendmentAmendmentPathVisualizationThemeValueAlpha: '#a5d6a7',
  amendmentAmendmentPathVisualizationSuccessColorAlpha: '#66bb6a',
  amendmentAmendmentPathVisualizationSuccessColorBeta: '#2e7d32',
  authGoogleIconInfoColor: '#4285F4',
  authGoogleIconSuccessColor: '#34A853',
  authGoogleIconThemeValue: '#FBBC05',
  authGoogleIconDangerColor: '#EA4335',
  chartChartRendererInfoColor: '#2563eb',
  chartChartRendererInfoColorAlpha: '#0d9488',
  chartChartRendererAccentColor: '#7c3aed',
  chartChartRendererThemeValue: '#ea580c',
  chartChartRendererAccentColorAlpha: '#db2777',
  chartChartRendererThemeValueAlpha: '#65a30d',
  chartChartRendererInfoColorBeta: '#0891b2',
  chartChartRendererDangerColor: '#dc2626',
  editorUseEditorPresenceNeutralColor: '#888888',
  editorEditorViewShellSuccessColor: '#22c55e',
  floweditorFlowEditorOverlayColor: 'rgba(255, 255, 255, 0.9)',
  floweditorFlowEditorNeutralColor: '#aaa',
  floweditorUseFlowEditorAccentColor: '#ff0072',
  floweditorUseFlowEditorOverlayColor: 'rgba(240, 240, 240, 0.7)',
  floweditorUseFlowEditorInfoColor: '#bbdefb',
  floweditorFlowEditorDefaultsWarningColor: '#ffe0b2',
  groupUseFinancialDataThemeValue: '#0088FE',
  groupUseFinancialDataSuccessColor: '#00C49F',
  groupUseFinancialDataWarningColor: '#FFBB28',
  groupUseFinancialDataWarningColorAlpha: '#FF8042',
  groupUseFinancialDataAccentColor: '#8884d8',
  groupUseFinancialDataSuccessColorAlpha: '#82ca9d',
  groupUseFinancialDataThemeValueAlpha: '#ffc658',
  networkUseGroupNetworkFlowWarningColor: '#ffb74d',
  networkUseGroupNetworkFlowWarningColorAlpha: '#f59e0b',
  networkUseGroupNetworkFlowAccentColor: '#a855f7',
  networkUseGroupNetworkFlowSuccessColor: '#10b981',
  networkUseUserNetworkFlowInfoColor: '#2196f3',
  networkUseUserNetworkFlowInfoColorAlpha: '#1976d2',
  networkNetworkEdgeHelpersWarningColor: '#d97706',
  networkNetworkFilterHelpersNeutralColor: '#64748b',
  networkAmendmentPathVisualizationSuccessColor: '#f0fdf4',
  networkAmendmentPathVisualizationSuccessColorAlpha: '#14532d',
  networkAmendmentPathVisualizationOverlayColor: 'rgba(34, 197, 94, 0.2)',
  networkAmendmentPathVisualizationAccentColor: '#ec4899',
  networkAmendmentPathVisualizationAccentColorAlpha: '#fdf2f8',
  networkAmendmentPathVisualizationDangerColor: '#831843',
  networkAmendmentPathVisualizationOverlayColorAlpha: 'rgba(236, 72, 153, 0.22)',
  networkAmendmentPathVisualizationDangerColorAlpha: '#ef4444',
  networkAmendmentPathVisualizationDangerColorBeta: '#fff1f2',
  networkAmendmentPathVisualizationDangerColorGamma: '#7f1d1d',
  networkAmendmentPathVisualizationOverlayColorBeta: 'rgba(239, 68, 68, 0.22)',
  networkAmendmentPathVisualizationNeutralColor: '#94a3b8',
  networkAmendmentPathVisualizationNeutralColorAlpha: '#f8fafc',
  networkAmendmentPathVisualizationNeutralColorBeta: '#334155',
  networkAmendmentPathVisualizationOverlayColorGamma: 'rgba(148, 163, 184, 0.18)',
  networkEventNetworkFlowSuccessColor: '#e8f5e9',
  networkEventNetworkFlowWarningColor: '#fbc02d',
  networkEventNetworkFlowSuccessColorAlpha: '#4caf50',
  networkNetworkVisualHelpersInfoColor: '#dbeafe',
  networkNetworkVisualHelpersInfoColorAlpha: '#1d4ed8',
  networkNetworkVisualHelpersSuccessColor: '#d1fae5',
  networkNetworkVisualHelpersSuccessColorAlpha: '#059669',
  networkNetworkVisualHelpersSuccessColorBeta: '#065f46',
  networkNetworkVisualHelpersWarningColor: '#ffedd5',
  networkNetworkVisualHelpersWarningColorAlpha: '#9a3412',
  networkNetworkVisualHelpersWarningColorBeta: '#fef3c7',
  networkNetworkVisualHelpersWarningColorGamma: '#92400e',
  networkNetworkVisualHelpersDangerColor: '#ffe4e6',
  networkNetworkVisualHelpersDangerColorAlpha: '#e11d48',
  networkNetworkVisualHelpersDangerColorBeta: '#9f1239',
  networkNetworkVisualHelpersAccentColor: '#ede9fe',
  networkNetworkVisualHelpersAccentColorAlpha: '#5b21b6',
  networkWorkflowFlowVisualizationInfoColor: '#42a5f5',
  networkWorkflowFlowVisualizationWarningColor: '#ffcc80',
  publiclandingLandingNetworkPreviewTealColor: '#ccfbf1',
  publiclandingLandingNetworkPreviewTealColorAlpha: '#134e4a',
  publiclandingPublicLandingPageNeutralColor: '#e5e7eb',
  publiclandingPublicLandingPageTealColor: '#0f766e',
  timelineImageOptimizationNeutralColor: '#f3f4f6',
} as const;

export type FeatureThemeValue = keyof typeof FEATURE_THEME_VALUES;

export function featureThemeValue(key: FeatureThemeValue): string {
  return FEATURE_THEME_VALUES[key];
}

export const FEATURE_THEME_MARKUP = {
  amendmentSupporterLocalityMapMapMarkerMarkup:
    '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#15803d;border:3px solid #ffffff;box-shadow:0 10px 24px rgba(21,128,61,0.35);"></span>',
  amendmentSupporterLocalityMapMapMarkerMarkupAlpha:
    '<span style="display:block;width:22px;height:22px;border-radius:9999px;background:#166534;border:3px solid #dcfce7;box-shadow:0 12px 28px rgba(22,101,52,0.45);"></span>',
  timelineCivicTimelineMapMapMarkerMarkup:
    '<span style="display:block;width:24px;height:24px;border-radius:9999px;background:#111827;border:4px solid #fef3c7;box-shadow:0 14px 30px rgba(17,24,39,0.42);"></span>',
  networkNetworkFlowBaseReactFlowDarkModeStyles:
    '\n      /* Dark mode styles for ReactFlow controls */\n      .dark .react-flow__controls {\n        button {\n          background-color: hsl(var(--background));\n          border-color: hsl(var(--border));\n          color: hsl(var(--foreground));\n        }\n\n        button:hover {\n          background-color: hsl(var(--accent));\n        }\n\n        button path {\n          fill: currentColor;\n        }\n      }\n\n      /* Dark mode styles for MiniMap */\n      .dark .react-flow__minimap {\n        background-color: hsl(var(--background));\n        border-color: hsl(var(--border));\n      }\n\n      .dark .react-flow__minimap-mask {\n        fill: hsl(var(--muted) / 0.3);\n      }\n\n      /* Dark mode styles for Panel */\n      .dark .react-flow__panel {\n        background-color: hsl(var(--background));\n        border-color: hsl(var(--border));\n        color: hsl(var(--foreground));\n      }\n    ',
} as const;

export type FeatureThemeMarkup = keyof typeof FEATURE_THEME_MARKUP;

export function featureThemeMarkup(key: FeatureThemeMarkup): string {
  return FEATURE_THEME_MARKUP[key];
}

export function featureThemeGeneratedHsl(hue: number): string {
  return `hsl(${hue}, 70%, 50%)`;
}

export function featureThemeRgba(red: number, green: number, blue: number, alpha: number): string {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
