export * from './civic';

export const FEATURE_THEME_CLASS_NAMES = {
  agendaAccreditationSectionSuccessSurface:
    'flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950',
  agendaAccreditationSectionSuccessIcon: 'h-5 w-5 text-green-600 dark:text-green-400',
  agendaAccreditationSectionSuccessText: 'font-medium text-green-700 dark:text-green-300',
  agendaAccreditationSectionThemedText: 'text-[10px]',
  agendaAccreditationSectionSuccessIconAlpha: 'h-3 w-3 text-green-500',
  agendaAgendaActionBarAccentBadge:
    'animate-pulse border-fuchsia-300 text-fuchsia-700 hover:border-fuchsia-400 hover:bg-fuchsia-50 hover:text-fuchsia-800',
  agendaAgendaActionBarInfoBorder: 'border border-sky-300 px-3 text-sky-700',
  agendaAgendaActionBarSuccessBorder: 'border border-emerald-300 text-emerald-700',
  agendaAgendaActionBarSuccessBadge: 'border border-emerald-500 bg-emerald-500/10 text-emerald-700',
  agendaAgendaBadgesThemedText: 'font-mono text-[11px] tracking-wide uppercase',
  agendaAgendaCardSuccessGradientSurface:
    'before:animate-spin-slow relative overflow-hidden before:absolute before:inset-0 before:-z-10 before:rounded-lg before:bg-gradient-to-r before:from-green-500 before:via-emerald-500 before:to-green-500 before:p-[3px]',
  agendaAgendaElectionSectionInfoBackground: 'bg-blue-400/50',
  agendaAgendaElectionSectionWarningBadge:
    'rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100',
  agendaAgendaElectionSectionWarningSurface: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30',
  agendaAgendaElectionSectionWarningIcon: 'h-4 w-4 text-yellow-500',
  agendaAgendaElectionSectionSuccessIcon: 'h-4 w-4 text-green-500',
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
    'rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 shadow-sm',
  agendaAgendaItemContextCardSuccessSurface:
    'rounded-xl border border-green-500/25 bg-green-500/10 p-3 shadow-sm',
  agendaAgendaItemContextCardInfoSurface:
    'rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 shadow-sm',
  agendaAgendaItemContextCardNeutralSurface:
    'rounded-xl border border-slate-500/20 bg-slate-500/5 p-3 shadow-sm',
  agendaAgendaItemContextCardDangerSurface:
    'rounded-xl border border-red-500/25 bg-red-500/10 p-3 shadow-sm',
  agendaAgendaVoteSectionSuccessBackground: 'bg-[var(--badge-success-fg)]',
  agendaAgendaVoteSectionSuccessBackgroundAlpha: 'bg-[var(--badge-success-bg)]',
  agendaAgendaVoteSectionDangerBackground: 'bg-[var(--badge-danger-fg)]',
  agendaAgendaVoteSectionDangerBackgroundAlpha: 'bg-[var(--badge-danger-bg)]',
  agendaAgendaVoteSectionNeutralBackground: 'bg-gray-400',
  agendaAgendaVoteSectionNeutralBackgroundAlpha: 'bg-gray-300/60',
  agendaAgendaVoteSectionInfoBackground: 'bg-blue-500',
  agendaAgendaVoteSectionInfoBackgroundAlpha: 'bg-blue-300/60',
  agendaAgendaVoteSectionAccentBackground: 'bg-purple-500',
  agendaAgendaVoteSectionAccentBackgroundAlpha: 'bg-purple-300/60',
  agendaAgendaVoteSectionWarningBackground: 'bg-orange-500',
  agendaAgendaVoteSectionWarningBackgroundAlpha: 'bg-orange-300/60',
  agendaChangeRequestCardsListSuccessBadge:
    'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  agendaChangeRequestCardsListWarningBadge:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  agendaChangeRequestCardsListSuccessBadgeAlpha:
    'ml-0.5 border-green-500/30 bg-green-500/10 text-xs text-green-700 dark:text-green-400',
  agendaChangeRequestTimelineCardSuccessIcon: 'h-5 w-5 text-green-500',
  agendaChangeRequestTimelineCardInfoLoadingIcon: 'h-5 w-5 animate-spin text-blue-500',
  agendaChangeRequestTimelineCardInfoRing: 'ring-2 ring-blue-500/50',
  agendaChangeRequestTimelineCardInfoText:
    'mb-2 text-sm font-semibold text-blue-600 dark:text-blue-400',
  agendaChangeRequestTimelineCardInfoPanel: 'rounded-lg bg-blue-500/10 p-3',
  agendaChangeRequestTimelineCardDangerText:
    'mb-1 text-sm font-semibold text-red-600 dark:text-red-400',
  agendaChangeRequestTimelineCardDangerPanel: 'rounded-lg bg-red-500/10 p-3 line-through',
  agendaChangeRequestTimelineCardSuccessText:
    'mb-1 text-sm font-semibold text-green-600 dark:text-green-400',
  agendaChangeRequestTimelineCardSuccessPanel: 'rounded-lg bg-green-500/10 p-3',
  agendaChangeRequestTimelineCardSuccessBackground: 'bg-green-600 hover:bg-green-700',
  agendaEventAgendaThemedBackground:
    'bg-primary absolute -top-3 right-6 left-6 z-20 h-0.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.9)]',
  agendaEventAgendaSuccessContrastRoundIcon:
    'flex h-6 w-6 items-center justify-center rounded-full border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)] shadow-sm',
  agendaEventAgendaSuccessBorder: 'border-[var(--badge-success-border)]',
  agendaEventAgendaThemedBorder: 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]',
  agendaEventAgendaThemedBackgroundAlpha:
    'bg-primary absolute right-6 -bottom-3 left-6 z-20 h-0.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.9)]',
  agendaEventAgendaThemedPanel: 'flex w-full items-center justify-between p-0 hover:bg-transparent',
  agendaEventAgendaDangerIcon: 'h-5 w-5 text-red-500',
  agendaEventAgendaThemedStyle: 'h-4 w-4 fill-current',
  agendaEventAgendaSuccessPulseDot:
    'absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-green-500',
  agendaEventAgendaWarningRoundIcon: 'absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500',
  agendaEventAgendaContrastBackground: 'relative w-full overflow-hidden rounded-lg bg-black',
  agendaEventAgendaAccentRoundIcon:
    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 md:h-10 md:w-10 dark:bg-purple-900',
  agendaEventAgendaAccentIcon: 'h-4 w-4 text-purple-600 md:h-5 md:w-5 dark:text-purple-300',
  agendaEventAgendaWarningRoundIconAlpha:
    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 md:h-10 md:w-10 dark:bg-orange-900',
  agendaEventAgendaWarningIcon: 'h-4 w-4 text-orange-600 md:h-5 md:w-5 dark:text-orange-300',
  agendaEventAgendaInfoRoundIcon:
    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 md:h-10 md:w-10 dark:bg-blue-900',
  agendaEventAgendaInfoIcon: 'h-4 w-4 text-blue-600 md:h-5 md:w-5 dark:text-blue-300',
  agendaEventStreamSectionSuccessBackground:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  agendaEventStreamSectionInfoBackground:
    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  agendaEventStreamSectionNeutralBackground:
    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  agendaEventStreamSectionAccentBackground:
    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  agendaEventStreamSectionWarningBackground:
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  agendaEventStreamSectionTealBackground:
    'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  agendaEventStreamSectionSuccessContrastPulseDot:
    'absolute -top-1 -right-1 flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-green-500 text-white',
  agendaEventStreamSectionContrastStyle: 'h-2 w-2 fill-white',
  agendaEventStreamSectionContrastBackground:
    'relative w-full overflow-hidden rounded-lg bg-black shadow-xl',
  agendaEventStreamSectionThemedPanel: 'flex items-center gap-2 p-0 hover:bg-transparent',
  agendaEventStreamSectionSuccessBackgroundAlpha: 'bg-green-100 dark:bg-green-900',
  agendaTransferAgendaItemDialogWarningSurface:
    'flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/50',
  agendaTransferAgendaItemDialogWarningIcon:
    'h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400',
  agendaTransferAgendaItemDialogWarningText: 'text-sm text-amber-800 dark:text-amber-200',
  amendmentAmendmentWikiNeutralContrastGradientSurface:
    'bg-gradient-to-br from-slate-50 via-white to-slate-100',
  amendmentAmendmentWikiSuccessTealGradientSurface:
    'bg-gradient-to-br from-emerald-50 via-white to-teal-100',
  amendmentAmendmentWikiWarningContrastGradientSurface:
    'bg-gradient-to-br from-amber-50 via-white to-orange-100',
  amendmentAmendmentWikiInfoContrastGradientSurface:
    'bg-gradient-to-br from-sky-50 via-white to-cyan-100',
  amendmentAmendmentHelpersSuccessBadge: 'bg-green-500/10 text-green-500 border-green-500/20',
  amendmentAmendmentHelpersDangerBadge: 'bg-red-500/10 text-red-500 border-red-500/20',
  amendmentAmendmentHelpersWarningBadge: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  amendmentAmendmentHelpersWarningBadgeAlpha:
    'bg-orange-500/10 text-orange-500 border-orange-500/20',
  amendmentAmendmentHelpersInfoBadge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  amendmentAmendmentHelpersNeutralBadge: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  amendmentAmendmentPathHelpersThemedGradientSurface:
    'traverses explicit holder-to-scope grants from B2 through H2 to K2 only forward',
  amendmentAmendmentEditContentWarningText: 'text-xs text-amber-600',
  amendmentAmendmentEditContentInfoPanel: 'rounded-lg bg-blue-50 p-4 dark:bg-blue-950',
  amendmentAmendmentEditContentInfoText: 'text-sm font-semibold text-blue-900 dark:text-blue-100',
  amendmentAmendmentEditContentInfoTextAlpha: 'mt-1 text-xs text-blue-700 dark:text-blue-300',
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
  featureThemeWarningSurface: 'mb-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20',
  featureThemeWarningIcon: 'h-5 w-5 text-amber-600',
  featureThemeWarningText: 'text-amber-800 dark:text-amber-200',
  featureThemeWarningTextAlpha: 'mb-3 text-sm text-amber-700 dark:text-amber-300',
  featureThemeNeutralContrastSurface:
    'flex items-center justify-between gap-2 rounded-md border bg-white p-2 dark:bg-gray-900',
  featureThemeSuccessBackground: 'h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700',
  featureThemeDangerBackground: 'h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700',
  assistantAriaKaiStepInfoAccentGradientSurface:
    'bg-gradient-to-br from-purple-500 to-blue-500 text-2xl text-white',
  assistantAriaKaiStepAccentIcon: 'mt-0.5 h-5 w-5 flex-shrink-0 text-purple-500',
  assistantAriaKaiStepInfoIcon: 'mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500',
  authAuthGuardInfoLoadingIcon: 'h-8 w-8 animate-spin text-blue-500',
  authGroupSearchStepSuccessGradientSurface:
    'rounded-full bg-gradient-to-br from-green-500 to-emerald-600 p-4',
  authGroupSearchStepContrastIcon: 'h-8 w-8 text-white',
  authGroupSearchStepSuccessNeutralBorder:
    'border-emerald-500 ring-2 ring-emerald-500/20 ring-offset-2 dark:border-emerald-400 dark:ring-emerald-400/25 dark:ring-offset-gray-900',
  authGroupSearchStepSuccessPanel: 'rounded-full bg-emerald-500 p-1 dark:bg-emerald-400',
  authGroupSearchStepSuccessContrastIcon: 'h-3 w-3 text-white dark:text-emerald-950',
  authMembershipConfirmStepAccentGradientSurface:
    'rounded-full bg-gradient-to-br from-purple-500 to-violet-600 p-4',
  authMembershipConfirmStepSuccessBadge:
    'rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950',
  authMembershipConfirmStepSuccessPanel: 'rounded-full bg-green-500 p-2',
  authMembershipConfirmStepContrastIcon: 'h-5 w-5 text-white',
  authMembershipConfirmStepSuccessText: 'font-medium text-green-800 dark:text-green-200',
  authNameStepInfoAccentGradientSurface:
    'rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-4',
  authNameStepSuccessText: 'text-emerald-600 dark:text-emerald-400',
  authSummaryStepWarningGradientSurface:
    'rounded-full bg-gradient-to-br from-amber-500 to-orange-600 p-4',
  authSummaryStepContrastIcon: 'h-4 w-4 text-white',
  authSummaryStepSuccessText: 'text-sm text-green-700 dark:text-green-300',
  authSummaryStepSuccessTextAlpha: 'font-semibold text-green-900 dark:text-green-100',
  authSummaryStepInfoPanel: 'rounded-full bg-blue-500 p-2',
  authSummaryStepInfoText: 'text-sm text-blue-700 dark:text-blue-300',
  authSummaryStepInfoTextAlpha: 'font-semibold text-blue-900 dark:text-blue-100',
  authSummaryStepInfoIcon: 'h-5 w-5 text-blue-600 dark:text-blue-400',
  authSummaryStepNeutralPanel: 'rounded-full bg-gray-400 p-2',
  authSummaryStepNeutralText: 'text-sm text-gray-600 dark:text-gray-400',
  authSummaryStepAccentPanel: 'rounded-full bg-purple-500 p-2',
  authSummaryStepAccentText: 'text-sm text-purple-700 dark:text-purple-300',
  authSummaryStepAccentTextAlpha: 'font-semibold text-purple-900 dark:text-purple-100',
  authSummaryStepAccentIcon: 'h-5 w-5 text-purple-600 dark:text-purple-400',
  authAccessDeniedDangerRoundIcon:
    'mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20',
  authAccessDeniedDangerIcon: 'h-10 w-10 text-red-600 dark:text-red-400',
  authForgotPasswordFormSuccessIcon: 'h-12 w-12 text-emerald-500',
  authForgotPasswordFormInfoIcon: 'h-12 w-12 text-blue-500',
  authSignInFormContrastBadge:
    'mt-4 w-full border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed] dark:hover:bg-[#303134]',
  createUseCreateGroupFormSuccessIcon: 'h-4 w-4 text-emerald-700',
  createUseCreateGroupFormSuccessText: 'text-xs tracking-wide text-emerald-700 uppercase',
  createUseCreateGroupFormSuccessBadge:
    'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50',
  createUseCreateGroupFormDangerText: 'text-xs tracking-wide text-rose-700 uppercase',
  createUseCreateGroupFormDangerBadge: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50',
  createUseCreateGroupFormWarningText: 'text-xs tracking-wide text-amber-700 uppercase',
  createUseCreateGroupFormWarningSurface: 'rounded-md border border-amber-200 bg-amber-50/60 p-3',
  createUseCreateGroupFormWarningTextAlpha: 'text-sm font-medium text-amber-900',
  createUseCreateGroupFormWarningTextBeta: 'text-xs text-amber-800',
  createUseCreateGroupFormWarningBadge:
    'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50',
  createCreateFieldsSuccessRing:
    'focus-visible:ring-emerald-500/20 dark:focus-visible:ring-emerald-500/30',
  createCreateFieldsThemedBorder:
    'border-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
  createCreateFieldsSuccessBorder:
    'border-emerald-500 focus-visible:ring-emerald-500/20 dark:border-emerald-400 dark:focus-visible:ring-emerald-500/30',
  createCreateFieldsThemedBorderAlpha:
    '[&_[data-slot=input]]:border-destructive [&_[data-slot=input]]:focus-visible:ring-destructive/20 dark:[&_[data-slot=input]]:focus-visible:ring-destructive/40 [&_[data-slot=typeahead-selected]]:border-destructive [&_[data-slot=typeahead-selected-list]]:border-destructive',
  createCreateFieldsSuccessBorderAlpha:
    '[&_[data-slot=input]]:border-emerald-500 [&_[data-slot=input]]:focus-visible:ring-emerald-500/20 dark:[&_[data-slot=input]]:border-emerald-400 dark:[&_[data-slot=input]]:focus-visible:ring-emerald-500/30 [&_[data-slot=typeahead-selected]]:border-emerald-500 dark:[&_[data-slot=typeahead-selected]]:border-emerald-400',
  createCreateFieldsThemedBorderBeta:
    '[&_[data-slot=input]]:border-destructive [&_[data-slot=input]]:focus-visible:ring-destructive/20 dark:[&_[data-slot=input]]:focus-visible:ring-destructive/40 [&_[data-slot=typeahead-selected]]:border-destructive',
  createCreateProgressIndicatorThemedRoundIcon:
    'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
  decisionterminalDecisionStatusSuccessText: 'text-green-600 dark:text-green-400',
  decisionterminalDecisionStatusWarningText: 'text-yellow-600 dark:text-yellow-400',
  decisionterminalDecisionStatusWarningTextAlpha: 'text-orange-600 dark:text-orange-400',
  decisionterminalDecisionStatusDangerText: 'text-red-600 dark:text-red-400 animate-pulse',
  decisionterminalDecisionStatusDangerTextAlpha: 'text-red-600 dark:text-red-400',
  decisionterminalDecisionStatusNeutralText: 'text-gray-600 dark:text-gray-400',
  decisionterminalCountdownTimerWarningText: 'text-amber-600 dark:text-amber-400',
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
  decisionterminalDecisionSummaryInfoText: 'text-blue-600 dark:text-blue-400',
  decisionterminalDecisionSummaryNeutralBorder:
    'border-b border-gray-200 last:border-b-0 dark:border-gray-700',
  decisionterminalDecisionSummaryNeutralPanel:
    'h-auto w-full justify-between rounded-none p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
  decisionterminalDecisionSummaryNeutralIcon: 'h-4 w-4 text-gray-400',
  decisionterminalDecisionSummaryNeutralText: 'px-3 pb-3 text-sm text-gray-600 dark:text-gray-300',
  decisionterminalDecisionSummaryNeutralBorderAlpha:
    'rounded-lg border border-gray-200 dark:border-gray-700',
  decisionterminalDecisionSummaryNeutralSurface:
    'flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50',
  decisionterminalDecisionSummaryNeutralTextAlpha:
    'text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400',
  decisionterminalDecisionSummaryNeutralTextBeta: 'text-gray-600 transition-all dark:text-gray-300',
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
  decisionterminalDecisionWidgetContentSuccessBackground: 'bg-emerald-500',
  decisionterminalDecisionWidgetContentWarningBackground: 'bg-amber-500',
  decisionterminalDecisionWidgetContentThemedTextDelta:
    'text-muted-foreground mt-0.5 flex items-center gap-2 font-mono text-[11px]',
  decisionterminalDecisionWidgetContentThemedTextEpsilon:
    'text-muted-foreground truncate text-[11px]',
  decisionterminalFlashRowSuccessShadow: 'shadow-green-500/30',
  decisionterminalFlashRowDangerShadow: 'shadow-red-500/30',
  decisionterminalFlashRowWarningShadow: 'shadow-yellow-500/30',
  decisionterminalFlashRowSuccessBackground: 'bg-green-50 dark:bg-green-950/30',
  decisionterminalFlashRowDangerBackground: 'bg-red-50 dark:bg-red-950/30',
  decisionterminalFlashRowWarningBackground: 'bg-yellow-50 dark:bg-yellow-950/30',
  decisionterminalFlashRowWarningBackgroundAlpha: 'bg-yellow-500',
  decisionterminalMobileDecisionCardThemedText: 'text-muted-foreground mr-2 font-mono text-[10px]',
  decisionterminalMobileDecisionCardThemedTextAlpha:
    'text-muted-foreground mt-0.5 truncate font-mono text-[10px] tracking-[1px] uppercase',
  decisionterminalTerminalHeaderNeutralBorder: 'border-b border-gray-200 dark:border-gray-700',
  decisionterminalTerminalHeaderDangerText: 'animate-pulse text-red-500',
  decisionterminalTerminalHeaderDangerTextAlpha: 'font-medium text-red-600 dark:text-red-400',
  decisionterminalTrendIndicatorSuccessBackground: 'bg-emerald-50 dark:bg-emerald-950/30',
  decisionterminalTrendIndicatorWarningBackground: 'bg-amber-50 dark:bg-amber-950/30',
  delegateDelegatesOverviewWarningSurface:
    'flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-50 p-3 dark:bg-yellow-900/20',
  delegateDelegatesOverviewWarningIcon: 'h-4 w-4 text-yellow-600 dark:text-yellow-400',
  delegateDelegatesOverviewWarningText: 'text-sm text-yellow-800 dark:text-yellow-200',
  delegateDelegatesOverviewSuccessSurface:
    'flex items-center gap-3 rounded-lg border bg-green-50 p-3 dark:bg-green-900/20',
  delegateDelegatesOverviewInfoSurface:
    'flex items-center gap-3 rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/20',
  discussionsCommentTreeWarningText: 'text-orange-500',
  discussionsCommentTreeInfoText: 'text-blue-500',
  docsDocsTopicsThemedGradientSurface: 'jump-to-target',
  documentUseAutoSaveThemedStyle: 'Auto-save failed:',
  documentPresenceIndicatorsContrastText: 'text-xs text-white',
  editorEditorHeaderWarningText: 'text-yellow-600',
  editorInviteCollaboratorDialogThemedText: 'text-[8px]',
  editorInviteCollaboratorDialogThemedPanel: 'h-4 w-4 p-0 hover:bg-transparent',
  eventCompactCalendarEventStylesSuccessBackground: 'bg-green-500/15 hover:bg-green-500/25',
  eventCompactCalendarEventStylesInfoSurface:
    'border border-dashed border-blue-300 bg-blue-500/10 hover:bg-blue-500/20 dark:border-blue-700',
  eventCompactCalendarEventStylesWarningBorder:
    'border border-amber-200/80 text-amber-950 shadow-sm hover:opacity-90 dark:border-amber-800/60 dark:text-amber-50',
  eventCompactCalendarEventStylesWarningText: 'text-amber-800/90 dark:text-amber-100/90',
  eventSharedMonthThemedText:
    'cursor-pointer rounded px-1 py-0.5 text-[11px] leading-tight transition-all',
  eventSharedWeekViewNeutralText:
    'text-muted-foreground absolute top-0 right-2 -translate-y-1/2 text-[11px] font-medium',
  eventSharedWeekViewThemedText: 'text-muted-foreground mb-2 text-[10px] font-medium',
  eventCancelEventDialogInfoIcon: 'h-4 w-4 text-blue-500',
  eventCancelEventDialogAccentIcon: 'h-4 w-4 text-purple-500',
  eventEventEditSuccessBadge:
    'rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm',
  eventEventStreamSuccessContrastPulseDot:
    'absolute -top-1 -right-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-green-500 text-white',
  eventEventStreamContrastStyle: 'h-3 w-3 fill-white',
  eventEventTimeSeriesSectionInfoBadge:
    'rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm',
  eventEventTimeSeriesSectionWarningBadge:
    'rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm',
  fileuploadImageUploadThemedText:
    'text-muted-foreground flex w-full items-center gap-3 text-[11px] font-medium tracking-[0.24em] uppercase',
  floweditorFlowEditorContrastPanel: 'rounded bg-white p-4 shadow',
  floweditorFlowEditorNeutralText: 'mb-3 text-sm text-gray-600',
  floweditorFlowEditorContrastPanelAlpha: 'w-80 rounded bg-white p-4 shadow',
  floweditorUseFlowEditorThemedStyle: '0 0 0 2px #ff0072',
  floweditorUseFlowEditorThemedStyleAlpha: '1px dashed #aaa',
  groupAddRoleDialogSuccessSurface: 'rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4',
  groupAddRoleDialogSuccessBorder:
    'border-emerald-500 text-emerald-950 dark:border-emerald-400 dark:text-emerald-50',
  groupAssignHolderDialogInfoBadge:
    'rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900',
  groupAssignHolderDialogWarningSurface: 'rounded-lg border border-orange-200 bg-orange-50 p-3',
  groupGroupConflictPanelWarningSurface:
    'space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4',
  groupGroupConflictPanelWarningIcon: 'mt-0.5 h-4 w-4 shrink-0 text-amber-700',
  groupMembershipRightsAlignmentPanelSuccessBackground:
    'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100',
  groupMembershipRightsAlignmentPanelWarningBackground:
    'bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100',
  groupMembershipRightsAlignmentPanelInfoBackground:
    'bg-sky-50 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100',
  groupMembershipRightsAlignmentPanelDangerBackground:
    'bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-100',
  groupOpenAssignmentsPanelSuccessBadge:
    'flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700',
  groupOpenAssignmentsPanelThemedBorder:
    'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]',
  groupOpenAssignmentsPanelThemedBorderAlpha: 'border-transparent',
  groupPaymentsSectionSuccessText: 'text-xl font-semibold text-green-600 dark:text-green-400',
  groupPaymentsSectionDangerText: 'text-xl font-semibold text-red-600 dark:text-red-400',
  groupRolesPermissionsTableThemedText: 'pointer-events-none text-[11px]',
  groupRoleTagContrastBorder: 'border-0 text-white shadow-sm shadow-black/10 dark:text-white',
  meetMeetingCalendarViewsSuccessBorder: 'border-green-300 dark:border-green-800',
  meetMeetingCalendarViewsInfoBorder: 'border-dashed border-blue-300 dark:border-blue-800',
  meetMeetingCalendarViewsThemedBackground: 'cursor-default hover:bg-transparent',
  messageAiContextCardsInfoIcon: 'h-5 w-5 text-sky-700 dark:text-sky-300',
  messageAiContextCardsInfoBadge:
    'inline-flex items-center gap-1.5 rounded-md border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-500/15 dark:text-sky-300',
  messageAiContextCardsThemedGradientSurface: 'overflow-hidden rounded-2xl bg-gradient-to-br',
  messageAiContextCardsThemedBorder:
    'flex items-center gap-1.5 border-b px-3 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase',
  messageAiContextCardsSuccessBadge:
    'border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  messageAiContextCardsInfoBadgeAlpha:
    'border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  messageAiContextCardsSuccessText:
    'mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-emerald-700 uppercase dark:text-emerald-300',
  messageAssistantMessageInputNeutralGradientSurface:
    'bg-gradient-to-br from-slate-200/80 via-slate-200/60 to-slate-100/40 text-slate-700 dark:bg-slate-700/20 dark:text-slate-200',
  messageAssistantMessageInputWarningGradientSurface:
    'bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-yellow-400/20 text-amber-700 dark:text-amber-200',
  messageAssistantMessageInputAccentGradientSurface:
    'bg-gradient-to-br from-fuchsia-500/20 via-purple-500/20 to-indigo-500/20 text-fuchsia-700 dark:text-fuchsia-200',
  messageAssistantMessageInputThemedText:
    'text-muted-foreground px-2 pt-1 text-[11px] font-semibold tracking-[0.14em] uppercase',
  messageAssistantMessageInputSuccessRoundIcon:
    'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold leading-none text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  messageAssistantMessageInputWarningRoundIcon:
    'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold leading-none text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  messageAssistantMessageInputSuccessRoundIconAlpha:
    'inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold leading-none text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  messageAssistantMessageInputWarningRoundIconAlpha:
    'inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold leading-none text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  messageAssistantMessageInputNeutralText: 'text-xs font-medium text-slate-900 dark:text-slate-100',
  messageAssistantMessageInputNeutralBorder: 'border-t border-slate-200 dark:border-slate-700',
  messageConversationListContrastRing:
    'opacity-100 shadow-sm ring-1 ring-black/10 dark:ring-white/15',
  messageLinkPreviewInfoIcon: 'h-5 w-5 text-blue-500',
  messageLinkPreviewAccentIcon: 'h-5 w-5 text-purple-500',
  messageLinkPreviewWarningIcon: 'h-5 w-5 text-orange-500',
  messageLinkPreviewAccentIconAlpha: 'h-5 w-5 text-pink-500',
  messageLinkPreviewInfoIconAlpha: 'h-5 w-5 text-cyan-500',
  messageLinkPreviewAccentIconBeta: 'h-5 w-5 text-indigo-500',
  messageMessageBubbleDangerBadge:
    'border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  messageMessageBubbleDangerText: 'text-red-700/70 dark:text-red-300/70',
  messageMessageListDangerBadge:
    'flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300',
  messageMessageListThemedText:
    'text-muted-foreground mb-1 text-[11px] font-medium tracking-[0.18em] uppercase',
  messageMessageListDangerText: 'flex items-start gap-2 text-sm text-red-700 dark:text-red-300',
  navigationNavItemListLayout:
    'grid w-full auto-rows-max grid-cols-2 gap-8 p-4 sm:grid-cols-3 md:grid-cols-4',
  navigationNavItemsUnauthenticatedThemedStyle: '/#features',
  navigationUserMenuDangerText: 'text-red-600 focus:text-red-600',
  networkUseGroupNetworkFlowThemedStyle: '0 0 0 2px #ff0072, 0 0 0 5px rgba(16, 185, 129, 0.35)',
  networkUseGroupNetworkFlowThemedStyleAlpha: '0 0 0 4px rgba(16, 185, 129, 0.35)',
  networkUseGroupNetworkFlowNeutralBorder: 'my-1 border-gray-200 dark:border-gray-700',
  networkUseGroupNetworkFlowNeutralSurface:
    'relative h-3 w-6 rounded-sm border border-gray-300 bg-gray-100',
  networkUseManageNetworkTabSuccessTealGradientSurface:
    'border-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90',
  networkUseManageNetworkTabInfoAccentGradientSurface:
    'border-0 bg-gradient-to-r from-sky-500 to-violet-500 text-white hover:opacity-90',
  networkUseManageNetworkTabWarningAccentGradientSurface:
    'border-0 bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white hover:opacity-90',
  networkUseManageWorkflowsTabWarningSurface: 'border-amber-500/20 bg-amber-500/5',
  networkUseManageWorkflowsTabSuccessSurface: 'border-emerald-500/20 bg-emerald-500/5',
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
  networkGroupConnectionStatusCellSuccessText: 'inline-flex text-emerald-600',
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
    'flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm',
  networkHierarchyConflictDialogSuccessIcon: 'h-4 w-4 shrink-0 text-emerald-600',
  networkNetworkControlPanelNeutralContrastBadge:
    'border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200 hover:text-slate-950 dark:border-white/70 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:hover:text-white',
  networkNetworkControlPanelSuccessBadge:
    'border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 hover:text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-100 dark:hover:bg-emerald-900 dark:hover:text-emerald-50',
  networkNetworkControlPanelInfoBadge:
    'border-blue-200 bg-blue-100 text-blue-900 hover:bg-blue-200 hover:text-blue-950 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-100 dark:hover:bg-blue-900 dark:hover:text-blue-50',
  networkNetworkControlPanelWarningBadge:
    'border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-200 hover:text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100 dark:hover:bg-amber-900 dark:hover:text-amber-50',
  networkNetworkControlPanelAccentBadge:
    'border-violet-200 bg-violet-100 text-violet-900 hover:bg-violet-200 hover:text-violet-950 dark:border-violet-800 dark:bg-violet-950/70 dark:text-violet-100 dark:hover:bg-violet-900 dark:hover:text-violet-50',
  networkNetworkControlPanelThemedSurface:
    'border-border/70 bg-background/95 dark:bg-card/95 rounded-lg border p-2 shadow-sm',
  networkNetworkControlPanelThemedBadge:
    'border-border bg-background/90 text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-card/90 dark:text-foreground',
  networkNetworkControlPanelThemedSurfaceAlpha:
    'border-border/80 bg-background/95 dark:bg-background/95 flex max-h-[calc(100%-1rem)] w-[calc(100%-1rem)] max-w-sm flex-col overflow-hidden rounded border p-4 shadow-lg supports-[backdrop-filter]:backdrop-blur-sm',
  networkNetworkControlPanelNeutralText: 'mb-3 text-sm text-gray-600 dark:text-gray-400',
  networkNetworkControlPanelInfoPanel:
    'mt-3 shrink-0 rounded-md bg-blue-50 p-2 text-sm dark:bg-blue-950/20',
  networkNetworkControlPanelInfoText: 'text-blue-700 dark:text-blue-300',
  networkNetworkControlPanelThemedSurfaceBeta:
    'border-border/70 bg-background/95 dark:bg-card/95 mt-3 flex min-h-0 flex-1 flex-col rounded-lg border p-3 shadow-sm',
  networkNetworkControlPanelNeutralSurface:
    'h-4 w-4 rounded border-2 border-solid border-gray-400 bg-gray-100',
  networkNetworkControlPanelNeutralSurfaceAlpha:
    'h-4 w-4 rounded border-2 border-dashed border-gray-400 bg-gray-100',
  networkNetworkControlPanelThemedSurfaceGamma:
    'h-4 w-4 rounded border-2 border-[#fbbf24] bg-[#fff8e1]',
  networkNetworkEntityDialogSuccessBadge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  networkNetworkEntityDialogInfoBadge: 'border-blue-200 bg-blue-50 text-blue-700',
  networkNetworkEntityDialogWarningBadge: 'border-amber-200 bg-amber-50 text-amber-700',
  networkRightFiltersThemedSurface:
    'border-border/70 bg-background/95 dark:bg-card/95 mt-4 rounded-lg border p-3 shadow-sm',
  networkWorkflowFlowVisualizationThemedSurface:
    'h-4 w-4 rounded border border-[#90caf9] bg-[#bbdefb]',
  networkWorkflowFlowVisualizationThemedSurfaceAlpha:
    'h-4 w-4 rounded border border-[#ffcc80] bg-[#ffe0b2]',
  networkWorkflowFlowVisualizationSuccessIcon: 'h-4 w-4 text-emerald-600',
  networkWorkflowFlowVisualizationWarningIcon: 'h-4 w-4 text-amber-600',
  networkWorkflowEditorThemedGradientSurface:
    'offers next workflow-step targets only in holder-to-scope grant direction',
  notificationNotificationItemInfoRing: 'h-5 w-5 hover:ring-1 hover:ring-blue-500',
  notificationNotificationItemInfoContrastBackground: 'bg-blue-500 text-[10px] text-white',
  notificationNotificationAccentText: 'text-purple-500',
  notificationNotificationSuccessText: 'text-green-500',
  notificationNotificationAccentTextAlpha: 'text-pink-500',
  notificationNotificationAccentTextBeta: 'text-indigo-500',
  notificationNotificationInfoText: 'text-cyan-500',
  notificationNotificationDangerText: 'text-red-500',
  notificationNotificationInfoTextAlpha: 'text-blue-400',
  notificationNotificationNeutralText: 'text-slate-500',
  notificationNotificationWarningText: 'text-amber-500',
  notificationNotificationWarningTextAlpha: 'text-yellow-500',
  notificationNotificationInfoTextBeta: 'text-cyan-400',
  notificationNotificationSuccessTextAlpha: 'text-emerald-500',
  notificationNotificationAccentTextGamma: 'text-violet-500',
  notificationNotificationAccentTextDelta: 'text-purple-400',
  notificationNotificationAccentTextEpsilon: 'text-indigo-400',
  notificationNotificationAccentTextZeta: 'text-violet-400',
  notificationNotificationWarningTextBeta: 'text-amber-400',
  notificationNotificationDangerTextAlpha: 'text-rose-500',
  notificationNotificationDangerTextBeta: 'text-rose-400',
  paymentSubscriptionPlansGridSuccessSurface:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] shadow-[var(--shadow-card)]',
  paymentSubscriptionPlansGridSuccessPanel:
    'rounded-full border border-[var(--badge-success-border)] bg-[var(--surface-overlay)] px-2 py-0.5 text-xs font-medium text-[var(--badge-success-fg)] shadow-sm',
  paymentSubscriptionStatusDangerIcon: 'h-4 w-4 text-red-500',
  positionPositionsTableWarningIcon: 'h-4 w-4 text-orange-500',
  positionPositionsTableWarningText: 'mt-2 block font-semibold text-orange-600',
  pqlPqlFilterBuilderDialogSuccessBorder:
    'border-emerald-500 focus-visible:ring-emerald-500 dark:border-emerald-400',
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
  timelineContentTypeConfigSuccessBorder: 'border-emerald-500',
  timelineContentTypeConfigWarningGradientSurface: 'from-orange-100 to-yellow-100',
  timelineContentTypeConfigWarningGradientSurfaceAlpha:
    'dark:from-orange-900/40 dark:to-yellow-900/50',
  timelineContentTypeConfigWarningBorder: 'border-amber-500',
  timelineContentTypeConfigInfoAccentGradientSurface: 'from-cyan-100 via-sky-100 to-indigo-100',
  timelineContentTypeConfigInfoAccentGradientSurfaceAlpha:
    'dark:from-cyan-900/40 dark:via-sky-900/40 dark:to-indigo-900/50',
  timelineContentTypeConfigInfoText: 'text-sky-700 dark:text-sky-300',
  timelineContentTypeConfigInfoBorder: 'border-sky-500',
  timelineContentTypeConfigInfoAccentGradientSurfaceBeta: 'from-purple-100 to-blue-100',
  timelineContentTypeConfigInfoAccentGradientSurfaceGamma:
    'dark:from-purple-900/40 dark:to-blue-900/50',
  timelineContentTypeConfigAccentText: 'text-violet-600 dark:text-violet-400',
  timelineContentTypeConfigAccentBorder: 'border-violet-500',
  timelineContentTypeConfigInfoGradientSurface: 'from-sky-100 to-cyan-100',
  timelineContentTypeConfigInfoGradientSurfaceAlpha: 'dark:from-sky-900/40 dark:to-cyan-900/50',
  timelineContentTypeConfigDangerWarningGradientSurface: 'from-red-100 to-orange-100',
  timelineContentTypeConfigDangerWarningGradientSurfaceAlpha:
    'dark:from-red-900/40 dark:to-orange-900/50',
  timelineContentTypeConfigDangerBorder: 'border-red-500',
  timelineContentTypeConfigDangerAccentGradientSurface: 'from-rose-100 to-pink-100',
  timelineContentTypeConfigDangerAccentGradientSurfaceAlpha:
    'dark:from-rose-900/40 dark:to-pink-900/50',
  timelineContentTypeConfigDangerText: 'text-rose-600 dark:text-rose-400',
  timelineContentTypeConfigDangerBorderAlpha: 'border-rose-500',
  timelineContentTypeConfigDangerAccentGradientSurfaceBeta: 'from-pink-100 to-red-100',
  timelineContentTypeConfigDangerAccentGradientSurfaceGamma:
    'dark:from-pink-900/40 dark:to-red-900/50',
  timelineContentTypeConfigInfoGradientSurfaceBeta: 'from-cyan-100 to-blue-100',
  timelineContentTypeConfigInfoGradientSurfaceGamma: 'dark:from-cyan-900/40 dark:to-blue-900/50',
  timelineContentTypeConfigInfoTextAlpha: 'text-sky-600 dark:text-sky-400',
  timelineContentTypeConfigAccentGradientSurface: 'from-indigo-100 to-purple-100',
  timelineContentTypeConfigAccentGradientSurfaceAlpha:
    'dark:from-indigo-900/40 dark:to-purple-900/50',
  timelineContentTypeConfigAccentTextAlpha: 'text-indigo-600 dark:text-indigo-400',
  timelineContentTypeConfigAccentBorderAlpha: 'border-indigo-500',
  timelineContentTypeConfigSuccessGradientSurface: 'from-lime-100 to-emerald-100',
  timelineContentTypeConfigSuccessGradientSurfaceAlpha:
    'dark:from-lime-900/40 dark:to-emerald-900/50',
  timelineContentTypeConfigThemedText: 'text-lime-700 dark:text-lime-300',
  timelineContentTypeConfigThemedBorder: 'border-lime-500',
  timelineContentTypeConfigSuccessTealGradientSurface: 'from-teal-100 to-green-100',
  timelineContentTypeConfigSuccessTealGradientSurfaceAlpha:
    'dark:from-teal-900/40 dark:to-green-900/50',
  timelineContentTypeConfigTealText: 'text-teal-600 dark:text-teal-400',
  timelineContentTypeConfigTealBorder: 'border-teal-500',
  timelineContentTypeConfigSuccessTealGradientSurfaceBeta: 'from-emerald-100 to-teal-100',
  timelineContentTypeConfigSuccessTealGradientSurfaceGamma:
    'dark:from-emerald-900/40 dark:to-teal-900/50',
  timelineContentTypeConfigSuccessText: 'text-emerald-700 dark:text-emerald-300',
  timelineContentTypeConfigNeutralGradientSurface: 'from-gray-100 to-slate-100',
  timelineContentTypeConfigNeutralGradientSurfaceAlpha:
    'dark:from-gray-900/40 dark:to-slate-900/50',
  timelineContentTypeConfigNeutralText: 'text-slate-600 dark:text-slate-400',
  timelineContentTypeConfigNeutralBorder: 'border-slate-500',
  timelineContentTypeConfigDangerAccentGradientSurfaceDelta: 'from-fuchsia-100 to-rose-100',
  timelineContentTypeConfigDangerAccentGradientSurfaceEpsilon:
    'dark:from-fuchsia-900/40 dark:to-rose-900/50',
  timelineContentTypeConfigAccentTextBeta: 'text-fuchsia-700 dark:text-fuchsia-300',
  timelineContentTypeConfigAccentBorderBeta: 'border-fuchsia-500',
  timelineContentTypeConfigInfoAccentGradientSurfaceDelta: 'from-blue-100 to-indigo-100',
  timelineContentTypeConfigInfoAccentGradientSurfaceEpsilon:
    'dark:from-blue-900/40 dark:to-indigo-900/50',
  timelineContentTypeConfigInfoBorderAlpha: 'border-blue-500',
  timelineUseSwipeGesturesNeutralBackground: 'bg-gray-500',
  timelineUseTodoTimelineCardDangerText: 'text-red-600',
  timelineUseTodoTimelineCardDangerBackground: 'bg-red-100 dark:bg-red-900/40',
  timelineUseTodoTimelineCardWarningText: 'text-orange-600',
  timelineUseTodoTimelineCardWarningBackground: 'bg-orange-100 dark:bg-orange-900/40',
  timelineUseTodoTimelineCardWarningBackgroundAlpha: 'bg-yellow-100 dark:bg-yellow-900/40',
  timelineUseTodoTimelineCardSuccessText: 'text-green-600',
  timelineUseTodoTimelineCardSuccessBackground: 'bg-green-100 dark:bg-green-900/40',
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
  timelineActionBarNeutralText: 'flex items-center gap-3 text-gray-500 dark:text-gray-400',
  timelineActionBarAccentPanel:
    'h-auto gap-1 p-0 transition-colors hover:bg-transparent hover:text-pink-500',
  timelineActionBarInfoPanel:
    'h-auto gap-1 p-0 transition-colors hover:bg-transparent hover:text-blue-500',
  timelineActionTimelineCardAccentBackground: 'bg-purple-100 dark:bg-purple-900/40',
  timelineActionTimelineCardAccentText: 'text-purple-600 dark:text-purple-400',
  timelineActionTimelineCardInfoBackground: 'bg-blue-100 dark:bg-blue-900/40',
  timelineActionTimelineCardSuccessBackground: 'bg-emerald-100 dark:bg-emerald-900/40',
  timelineActionTimelineCardDangerBackground: 'bg-rose-100 dark:bg-rose-900/40',
  timelineActionTimelineCardWarningBackground: 'bg-amber-100 dark:bg-amber-900/40',
  timelineActionTimelineCardNeutralBackground: 'bg-gray-100 text-xs dark:bg-gray-800',
  timelineActionTimelineCardNeutralRoundIcon:
    'border-background flex h-8 w-8 items-center justify-center rounded-full border-2 bg-gray-100 text-xs font-medium dark:bg-gray-800',
  timelineActionTimelineCardNeutralPanel:
    'inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700',
  timelineAmendmentTimelineCardSuccessIcon: 'h-3.5 w-3.5 text-green-600',
  timelineAmendmentTimelineCardDangerIcon: 'h-3.5 w-3.5 text-red-600',
  timelineBlogTimelineCardContrastGradientSurface:
    'absolute inset-0 bg-gradient-to-t from-black/50 to-transparent',
  timelineBlogTimelineCardContrastText: 'line-clamp-2 text-lg leading-tight font-bold text-white',
  timelineBlogTimelineCardTealIcon: 'mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600 dark:text-teal-400',
  timelineElectionTimelineCardNeutralBackground: 'bg-gray-100 dark:bg-gray-900/40',
  timelineElectionTimelineCardDangerBackground: 'bg-rose-400 dark:bg-rose-500',
  timelineElectionTimelineCardDangerBackgroundAlpha: 'bg-rose-600 dark:bg-rose-400',
  timelineElectionTimelineCardNeutralBackgroundAlpha: 'bg-gray-300 dark:bg-gray-600',
  timelineElectionTimelineCardWarningRing: 'ring-2 ring-amber-400',
  timelineElectionTimelineCardDangerBackgroundBeta: 'bg-rose-100 text-xs dark:bg-rose-900/40',
  timelineElectionTimelineCardWarningNeutralIcon:
    'absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 text-amber-500',
  timelineElectionTimelineCardNeutralRoundIcon:
    'border-background flex h-10 w-10 items-center justify-center rounded-full border-2 bg-gray-100 text-xs font-medium dark:bg-gray-800',
  timelineElectionTimelineCardWarningBorder:
    'h-16 w-16 border-4 border-amber-400 ring-2 ring-amber-200 dark:ring-amber-800',
  timelineElectionTimelineCardDangerBackgroundGamma: 'bg-rose-100 text-lg dark:bg-rose-900/40',
  timelineElectionTimelineCardWarningNeutralIconAlpha:
    'absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 text-amber-500',
  timelineElectionTimelineCardWarningText:
    'mt-1 text-sm font-medium text-amber-600 dark:text-amber-400',
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
  timelinePaymentTimelineCardDangerText: 'text-rose-700 dark:text-rose-300',
  timelinePaymentTimelineCardSuccessBackground:
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  timelinePaymentTimelineCardDangerBackground: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  timelineQuickCommentThemedPanel:
    'text-muted-foreground hover:text-foreground h-auto gap-1.5 p-0 text-sm transition-colors hover:bg-transparent',
  timelineReasonDisplayWarningBackground: 'bg-orange-50 dark:bg-orange-950/30',
  timelineReasonDisplayInfoBackground: 'bg-blue-50 dark:bg-blue-950/30',
  timelineReasonDisplayNeutralText: 'text-gray-500',
  timelineReasonDisplayNeutralBackground: 'bg-gray-50 dark:bg-gray-950/30',
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
  timelineTodoTimelineCardSuccessIcon: 'h-4 w-4 text-green-600',
  timelineTopicPillSuccessText: 'text-green-700 dark:text-green-300',
  timelineTopicPillSuccessBorder: 'border-green-200 dark:border-green-800',
  timelineTopicPillInfoBorder: 'border-blue-200 dark:border-blue-800',
  timelineTopicPillWarningText: 'text-orange-700 dark:text-orange-300',
  timelineTopicPillWarningBorder: 'border-orange-200 dark:border-orange-800',
  timelineTopicPillWarningTextAlpha: 'text-yellow-700 dark:text-yellow-300',
  timelineTopicPillWarningBorderAlpha: 'border-yellow-200 dark:border-yellow-800',
  timelineTopicPillAccentText: 'text-purple-700 dark:text-purple-300',
  timelineTopicPillAccentBorder: 'border-purple-200 dark:border-purple-800',
  timelineTopicPillDangerText: 'text-red-700 dark:text-red-300',
  timelineTopicPillDangerBorder: 'border-red-200 dark:border-red-800',
  timelineTopicPillTealBackground: 'bg-teal-100 dark:bg-teal-900/40',
  timelineTopicPillTealText: 'text-teal-700 dark:text-teal-300',
  timelineTopicPillTealBorder: 'border-teal-200 dark:border-teal-800',
  timelineTopicPillNeutralBackground: 'bg-gray-100 dark:bg-gray-800',
  timelineTopicPillNeutralText: 'text-gray-700 dark:text-gray-300',
  timelineTopicPillNeutralBorder: 'border-gray-200 dark:border-gray-700',
  timelineUserTimelineCardInfoAccentGradientSurface:
    'bg-gradient-to-br from-blue-500 to-purple-500 text-white',
  timelineVideoTimelineCardDangerAccentGradientSurface:
    'flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-100 to-red-100 dark:from-pink-900/40 dark:to-red-900/50',
  timelineVideoTimelineCardContrastBackground:
    'absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100',
  timelineVideoTimelineCardContrastPanel:
    'transform rounded-full bg-white/90 p-4 shadow-lg transition-transform group-hover:scale-110',
  timelineVideoTimelineCardNeutralIcon: 'h-8 w-8 fill-gray-900 text-gray-900',
  timelineVideoTimelineCardContrastBackgroundAlpha:
    'absolute right-2 bottom-2 bg-black/80 font-mono text-xs text-white',
  timelineVideoTimelineCardContrastBackgroundBeta:
    'aspect-video w-full overflow-hidden rounded-lg bg-black',
  timelineVoteTimelineCardNeutralText: 'text-gray-600',
  timelineVoteTimelineCardDangerRing: 'ring-opacity-50 ring-2 ring-red-500',
  timelineVoteTimelineCardDangerBackground: 'animate-pulse bg-red-500',
  timelineVoteTimelineCardInfoIcon: 'h-3 w-3 text-blue-500',
  timelineVoteTimelineCardInfoIconAlpha: 'h-3 w-3 text-blue-400',
  timelineVoteTimelineCardInfoIconBeta: 'h-3 w-3 text-blue-300',
  timelineVoteTimelineCardSuccessIcon: 'h-3 w-3 text-green-600',
  timelineVoteTimelineCardDangerIcon: 'h-3 w-3 text-red-600',
  featureThemeThemedBorder:
    'display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #ffffff;box-shadow:0 10px 24px rgba(15,23,42,0.26);',
  timelineCivicTimelineMapNeutralText: 'text-[11px] text-slate-500',
  timelineCivicTimelineRailDangerBackground: 'bg-red-600',
  timelineCivicTimelineRailInfoBackground: 'bg-blue-600',
  timelineCivicTimelineRailSuccessBackground: 'bg-emerald-600',
  timelineTimelineModeToggleNeutralBackground:
    'bg-slate-900 text-slate-50 data-[state=on]:bg-slate-900 data-[state=on]:text-slate-50 dark:bg-slate-100 dark:text-slate-900 dark:data-[state=on]:bg-slate-100 dark:data-[state=on]:text-slate-900',
  timelineTimelineModeToggleNeutralBackgroundAlpha: 'hover:bg-slate-100 dark:hover:bg-slate-800',
  timelineTimelineModeToggleDangerRoundIcon:
    'absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75',
  timelineTimelineModeToggleDangerRoundIconAlpha:
    'relative inline-flex h-2 w-2 rounded-full bg-red-500',
  timelineGradientAssignmentThemedGradientSurface: 'bg-gradient-to-br',
  timelineGradientAssignmentThemedGradientSurfaceAlpha: 'from-',
  timelineGradientAssignmentThemedGradientSurfaceBeta: 'to-',
  timelineGradientAssignmentThemedStyle: 'dark:',
  timelineGradientAssignmentThemedGradientSurfaceGamma: 'bg-gradient',
  todoUseKanbanBoardNeutralContrastSurface:
    'border border-slate-200 bg-white dark:border-slate-800 dark:bg-black',
  userBadgeColorsInfoText: 'text-blue-800 dark:text-blue-300',
  userBadgeColorsSuccessText: 'text-green-800 dark:text-green-300',
  userBadgeColorsAccentText: 'text-purple-800 dark:text-purple-300',
  userBadgeColorsWarningText: 'text-amber-800 dark:text-amber-300',
  userBadgeColorsDangerText: 'text-rose-800 dark:text-rose-300',
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
  userAiSettingsTabDangerBorder: 'border-red-500 focus-visible:ring-red-500',
  userAiSettingsTabSuccessBorder: 'border-emerald-500 focus-visible:ring-emerald-500',
  userSocialBarInfoText:
    'text-cyan-600 transition-transform duration-200 hover:scale-110 hover:text-cyan-700',
  userSocialBarDangerText:
    'text-red-600 transition-transform duration-200 hover:scale-110 hover:text-red-700',
  userSocialBarInfoTextAlpha:
    'text-sky-700 transition-transform duration-200 hover:scale-110 hover:text-sky-800',
  userSocialBarSuccessText:
    'text-green-500 transition-transform duration-200 hover:scale-110 hover:text-green-600',
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
  featureThemeInfoBackground: 'bg-blue-100',
  featureThemeInfoText: 'text-blue-700',
  userUserWikiSuccessGradientSurface:
    'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/50',
  userUserWikiSuccessContrastBackground: 'bg-green-600 text-white hover:bg-green-700',
  userUserWikiDangerGradientSurface:
    'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/40 dark:to-rose-900/50',
  userUserWikiDangerText: 'text-red-800 dark:text-red-300',
  userUserWikiContrastText: 'text-white',
  userUserWikiInfoAccentGradientSurface:
    'bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/50',
  userUserWikiNeutralGradientSurface:
    'bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900/40 dark:to-slate-900/50',
  userUserWikiNeutralText: 'text-gray-800 dark:text-gray-300',
  userUserWikiNeutralBackground: 'bg-gray-100 dark:bg-gray-800/40',
  votecastVoteResultSentenceWarningText:
    'font-semibold text-yellow-700 underline underline-offset-4 hover:text-yellow-600 dark:text-yellow-400',
  votecastVoteResultSentenceWarningTextAlpha: 'font-semibold text-yellow-700 dark:text-yellow-400',
  votecastVoteResultSentenceWarningPanel:
    'flex items-center gap-2 rounded-lg bg-yellow-50 px-4 py-3 text-sm dark:bg-yellow-950/30',
  votecastVoteResultSentenceWarningIcon: 'h-5 w-5 shrink-0 text-yellow-500',
  votecastVoteResultSentenceSuccessBackground:
    'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300',
  votecastVoteResultSentenceDangerBackground:
    'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300',
  votecastVoteResultSentenceWarningBackground:
    'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
  voteAmendmentVotingQueueInfoSurface: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
  voteAmendmentVotingQueueNeutralSurface: 'border-gray-300 bg-gray-50 dark:bg-gray-900',
  voteAmendmentVotingQueueNeutralBorder: 'border-gray-200',
  voteAmendmentVotingQueueNeutralText: 'text-sm font-semibold text-gray-600',
  voteAmendmentVotingQueueDangerIcon: 'h-4 w-4 text-red-600',
  voteAmendmentVotingQueueNeutralIcon: 'h-4 w-4 text-gray-600',
  voteAmendmentVotingQueueSuccessBadge: 'flex-1 border-green-500 text-green-600 hover:bg-green-50',
  voteAmendmentVotingQueueDangerBadge: 'flex-1 border-red-500 text-red-600 hover:bg-red-50',
  voteAmendmentVotingQueueSuccessSurface: 'border-green-500 bg-green-50 dark:bg-green-950',
  voteAmendmentVotingQueueNeutralBorderAlpha: 'border-gray-300',
  voteVoteControlsSuccessBackground: 'flex-1 bg-green-600 hover:bg-green-700',
  voteVoteControlsNeutralBackground:
    'h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',
  voteVoteControlsSuccessBackgroundAlpha: 'h-full bg-green-600 transition-all',
  voteVoteControlsDangerBackground: 'h-full bg-red-600 transition-all',
  voteVoteControlsNeutralIcon: 'h-3 w-3 text-gray-600',
  voteVoteControlsNeutralBackgroundAlpha: 'h-full bg-gray-600 transition-all',
  voteVoteControlsSuccessBorder: 'border-green-600 text-green-600',
  voteVoteControlsDangerBorder: 'border-red-600 text-red-600',
  voteVoteControlsNeutralBorder: 'border-gray-600 text-gray-600',
  voteVotingPhaseIndicatorInfoBackground: 'bg-blue-400',
  voteVotingPhaseIndicatorSuccessBackground: 'bg-green-100 dark:bg-green-900/30',
  voteVotingPhaseIndicatorDangerBackground: 'bg-red-100 dark:bg-red-900/30',
  voteVotingPhaseIndicatorWarningText: 'text-amber-600',
  voteVotingPhaseIndicatorWarningBackground: 'bg-amber-100 dark:bg-amber-900/30',
  voteVotingPhaseIndicatorSuccessText: 'text-2xl font-bold text-green-600',
  voteVotingPhaseIndicatorDangerText: 'text-2xl font-bold text-red-600',
  voteVotingPhaseIndicatorNeutralText: 'text-2xl font-bold text-gray-600',
  voteVotingPhaseIndicatorDangerBackgroundAlpha:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  voteVotingSessionManagerWarningIcon: 'h-5 w-5 text-yellow-500',
  voteVotingSessionManagerSuccessPanel: 'rounded bg-green-100 p-2 dark:bg-green-900/30',
  voteVotingSessionManagerSuccessText: 'text-2xl font-bold text-green-600 dark:text-green-400',
  voteVotingSessionManagerDangerPanel: 'rounded bg-red-100 p-2 dark:bg-red-900/30',
  voteVotingSessionManagerDangerText: 'text-2xl font-bold text-red-600 dark:text-red-400',
  voteVotingSessionManagerNeutralPanel: 'rounded bg-gray-100 p-2 dark:bg-gray-800',
  voteVotingSessionManagerNeutralText: 'text-2xl font-bold text-gray-600 dark:text-gray-400',
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
  groupAddRoleDialogSuccessSurfaceAlpha: 'bg-muted/20 rounded-2xl border border-emerald-500/15 p-4',
  networkUseGroupNetworkFlowInfoContrastRoundIcon:
    'border-background absolute -top-1.5 -right-1.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-blue-500 text-white shadow-sm',
  networkUseGroupNetworkFlowWarningContrastRoundIcon:
    'border-background absolute -top-1.5 -right-1.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-amber-500 text-white shadow-sm',
  timelineVoteTimelineCardInfoProgressFill: 'h-2 opacity-60 [&>div]:bg-blue-400',
  timelineTodoTimelineCardSuccessProgressFill: '[&>div]:bg-green-500',
  timelineVoteTimelineCardDangerProgressFill: '[&>div]:bg-red-500',
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
