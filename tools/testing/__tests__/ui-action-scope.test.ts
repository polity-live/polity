import { describe, expect, it } from 'vitest';

import { parseActions, resolveHistoricalDebtKey } from '../ui-action-scope.mjs';

describe('semantic UI action inventory', () => {
  it('builds stable domain action ids from accessible text without AST hashes', () => {
    const [action] = parseActions(
      'src/features/groups/ui/GroupToolbarView.tsx',
      `export function View() { return <Button>Create group</Button>; }`
    );

    expect(action.actionId).toBe('groups.group-toolbar.create-group');
    expect(action.identifierSource).toBe('accessible-text');
    expect(action.legacyActionId).toMatch(/^Button-[a-f0-9]{10}$/);
  });

  it('leaves ambiguous actions unidentified instead of inventing positional ids', () => {
    const actions = parseActions(
      'src/features/groups/ui/GroupToolbarView.tsx',
      `export function View() { return <><Button /><Button /></>; }`
    );

    expect(actions).toHaveLength(2);
    expect(actions.every(action => action.actionId === undefined)).toBe(true);
    expect(actions.every(action => action.identifierSource === 'unidentified')).toBe(true);
  });

  it('ignores explicitly hidden controls, tooltip wrappers, and composite field configuration', () => {
    const actions = parseActions(
      'src/features/auth/ui/LoginView.tsx',
      `export function View() {
        return <>
          <input type="hidden" />
          <form className="hidden" onSubmit={submit} />
          <TooltipTrigger><span>Help</span></TooltipTrigger>
          <Link aria-hidden="true" />
          <TextField onValueChange={setEmail} />
          <input aria-label="Email" onChange={setEmail} />
        </>;
      }`
    );

    expect(actions).toHaveLength(1);
    expect(actions[0].tag).toBe('input');
    expect(actions[0].actionId).toBe('auth.login.email');
  });

  it('does not mistake composed tab content components for tab triggers', () => {
    const actions = parseActions(
      'src/routes/_authed/group/$id/network.tsx',
      `export function View() {
        return <><CurrentNetworkTab groupId="group-1" /><Tab onClick={select}>Current</Tab></>;
      }`
    );

    expect(actions).toHaveLength(1);
    expect(actions[0].tag).toBe('Tab');
  });

  it('ignores a composite area-picker surface whose concrete controls are scanned separately', () => {
    const actions = parseActions(
      'src/features/public-landing/ui/LandingCityDesignPreview.tsx',
      `<><StreetAreaPicker open onLoadOsm={loadOsm} onMapSelectionChange={setSelection} /><GeoAddressPicker values={values} onFieldChange={setField} /></>`
    );

    expect(actions).toEqual([]);
  });

  it('ignores icon and composite vote-button surfaces whose concrete controls are scanned separately', () => {
    const actions = parseActions(
      'src/features/decision-terminal/ui/DecisionVoteButtonView.tsx',
      `<><ExternalLink className="size-4" /><DecisionVoteButton decision={decision} onVote={vote} /></>`
    );

    expect(actions).toEqual([]);
  });

  it('ignores composite composer calls unless the consumer declares a distinct stable intent', () => {
    const concreteActions = parseActions(
      'src/features/messages/ui/MessageInputView.tsx',
      `<ChatComposer value={message} onSubmit={submit}><textarea /></ChatComposer>`
    );
    expect(concreteActions).toHaveLength(1);
    expect(concreteActions[0].tag).toBe('textarea');

    const [declaredAction] = parseActions(
      'src/features/messages/ui/MessageInputView.tsx',
      `<ChatComposer data-action-id="messages.composer.variant.submit" onSubmit={submit} />`
    );
    expect(declaredAction.actionId).toBe('messages.composer.variant.submit');
  });

  it('classifies a dynamically forwarded action id as a consumer alias', () => {
    const [action] = parseActions(
      'src/features/public-landing/ui/PublicLandingPage.tsx',
      `<SmartLink data-action-id={actionId} href={href}>Contact</SmartLink>`
    );

    expect(action.identifierSource).toBe('action-id-prop');
    expect(action.classification).toBe('transparent-wrapper');
    expect(action.aliasOfLegacyFingerprint).toBe('actionId');
  });

  it('keeps a concrete router link canonical when only its telemetry id is forwarded', () => {
    const [action] = parseActions(
      'src/features/shared/ui/UserIdentityLink.tsx',
      `<Link data-action-id={actionId} to="/user/$id">Profile</Link>`
    );

    expect(action.identifierSource).toBe('action-id-prop');
    expect(action.classification).toBe('canonical-action');
    expect(action.actionId).toBe('shared.user-identity-link.profile');
  });

  it('marks asChild composition as an alias candidate', () => {
    const actions = parseActions(
      'src/features/groups/ui/DeleteGroupView.tsx',
      `export function View() {
        return <DialogTrigger asChild><button aria-label="Delete group" /></DialogTrigger>;
      }`
    );

    expect(actions).toHaveLength(2);
    expect(actions[0].classification).toBe('transparent-wrapper');
    expect(actions[1].classification).toBe('canonical-action');
  });

  it('keeps the asChild target canonical when wrapper and child share an explicit ID', () => {
    const actions = parseActions(
      'src/routes/_authed/group/$id/events.tsx',
      `export function View() {
        return <Button asChild data-action-id="routes.group-events.event.create">
          <Link to="/create/event" data-action-id="routes.group-events.event.create">Create</Link>
        </Button>;
      }`
    );

    expect(actions.map(action => action.classification)).toEqual([
      'transparent-wrapper',
      'canonical-action',
    ]);
  });

  it('reports keyboard accessibility defects on custom click targets', () => {
    const [action] = parseActions(
      'src/features/events/ui/EventCardView.tsx',
      `export function View() { return <div onClick={openEvent}>Event</div>; }`
    );

    expect(action.accessibilityIssues).toEqual([
      'click-target-missing-role',
      'click-target-missing-tab-index',
      'click-target-missing-keyboard-handler',
    ]);
  });

  it('excludes wrappers that only prevent event propagation', () => {
    const actions = parseActions(
      'src/features/amendments/city-design/ui/CanvasPopover.tsx',
      `export function View() {
        return <div onClick={event => event.stopPropagation()}>Content</div>;
      }`
    );

    expect(actions).toEqual([]);
  });

  it('keeps custom targets whose handler also performs a user action', () => {
    const [action] = parseActions(
      'src/features/events/ui/EventCardView.tsx',
      `export function View() {
        return <div onClick={event => {
          event.stopPropagation();
          openEvent();
        }}>Event</div>;
      }`
    );

    expect(action.actionId).toBe('events.event-card.event');
    expect(action.classification).toBe('canonical-action');
  });

  it('excludes explicitly classified presentation states', () => {
    const actions = parseActions(
      'src/features/groups/ui/GroupMenu.tsx',
      `export function View() {
        return <DropdownMenuItem data-action-scope="presentation" disabled>No groups</DropdownMenuItem>;
      }`
    );

    expect(actions).toEqual([]);
  });

  it('leaves composite component accessibility to the scanned component implementation', () => {
    const [action] = parseActions(
      'src/features/meet/ui/MeetingCalendarViews.tsx',
      `export function View() { return <CompactMeetingCard onClick={selectMeeting} />; }`
    );

    expect(action.accessibilityIssues).toEqual([]);
  });

  it('preserves legacy debt while adopting an explicit id and aliases duplicate triggers', () => {
    const file = 'src/features/auth/ui/LoginView.tsx';
    const before = parseActions(
      file,
      `export function View() { return <form onSubmit={submit}><Button disabled={busy} /></form>; }`
    );
    const after = parseActions(
      file,
      `export function View() { return <form data-action-id="auth.login.submit.code" onSubmit={submit}><Button data-action-id="auth.login.submit.code" disabled={busy} /></form>; }`
    );

    expect(after.map(action => action.legacyActionId)).toEqual(
      before.map(action => action.legacyActionId)
    );
    expect(after.map(action => action.actionId)).toEqual([
      'auth.login.submit.code',
      'auth.login.submit.code',
    ]);
    expect(after.map(action => action.classification)).toEqual([
      'canonical-action',
      'transparent-wrapper',
    ]);
  });

  it('keeps a historical debt key when accessibility fixes change the AST fingerprint', () => {
    const file = 'src/features/search/ui/SpatialSearchResultsList.tsx';
    const [action] = parseActions(
      file,
      `export function View() {
        return <div data-action-id="search.spatial-result.select" role="button" tabIndex={0}
          onClick={select} onKeyDown={selectWithKeyboard}>Result</div>;
      }`
    );
    const historicalKey = `${file}#div-eb18fb7878`;
    const resolutions = {
      [historicalKey]: {
        status: 'pending',
        source: { file, tag: 'div', line: action.line - 3 },
      },
    };

    expect(
      resolveHistoricalDebtKey({
        file,
        action,
        computedDebtKey: `${file}#${action.legacyActionId}`,
        actionKey: `${file}#${action.actionId}`,
        legacyDebt: new Set([historicalKey]),
        knownLegacyKeys: new Set(),
        resolutions,
        previousDebtByActionKey: new Map(),
        previousDebtByHandler: new Map(),
        claimedDebtKeys: new Set(),
      })
    ).toBe(historicalKey);
  });

  it('keeps nearby historical debt for a dynamically forwarded action id', () => {
    const file = 'src/features/shared/ui/navigation/NavigationButtons.tsx';
    const [action] = parseActions(
      file,
      `<Button data-action-id={actionId} onClick={onClick}>Open</Button>`
    );
    const historicalKey = `${file}#Button-forwarded`;

    expect(
      resolveHistoricalDebtKey({
        file,
        action,
        computedDebtKey: `${file}#${action.legacyActionId}`,
        actionKey: `${file}#${action.actionId}`,
        legacyDebt: new Set([historicalKey]),
        knownLegacyKeys: new Set(),
        resolutions: {
          [historicalKey]: {
            status: 'pending',
            source: { file, tag: 'Button', line: action.line + 1 },
          },
        },
        previousDebtByActionKey: new Map(),
        previousDebtByHandler: new Map(),
        claimedDebtKeys: new Set(),
      })
    ).toBe(historicalKey);
  });

  it('does not attach a distant historical action to an unrelated new stable action', () => {
    const file = 'src/features/search/ui/SearchHeader.tsx';
    const [action] = parseActions(
      file,
      `export function View() { return <Button data-action-id="search.header.new-action" onClick={run} />; }`
    );
    const computedDebtKey = `${file}#${action.legacyActionId}`;
    const historicalKey = `${file}#Button-old`;

    expect(
      resolveHistoricalDebtKey({
        file,
        action,
        computedDebtKey,
        actionKey: `${file}#${action.actionId}`,
        legacyDebt: new Set([historicalKey]),
        knownLegacyKeys: new Set(),
        resolutions: {
          [historicalKey]: {
            status: 'pending',
            source: { file, tag: 'Button', line: action.line + 100 },
          },
        },
        previousDebtByActionKey: new Map(),
        previousDebtByHandler: new Map(),
        claimedDebtKeys: new Set(),
      })
    ).toBe(computedDebtKey);
  });

  it('does not transfer a resolved wrapper fingerprint to a colliding canonical action', () => {
    const file = 'src/features/timeline/ui/cards/AmendmentTimelineCardView.tsx';
    const [canonical] = parseActions(
      file,
      `<Button data-action-id="timeline.amendment.request.withdraw" onClick={withdraw}>Withdraw</Button>`
    );
    const computedDebtKey = `${file}#${canonical.legacyActionId}`;

    expect(
      resolveHistoricalDebtKey({
        file,
        action: canonical,
        computedDebtKey,
        actionKey: `${file}#${canonical.actionId}`,
        legacyDebt: new Set(),
        knownLegacyKeys: new Set(),
        resolutions: {
          [computedDebtKey]: {
            status: 'resolved',
            resolution: 'alias-of-action',
            source: { file, tag: 'Button', line: canonical.line + 20 },
          },
        },
        previousDebtByActionKey: new Map(),
        previousDebtByHandler: new Map(),
        claimedDebtKeys: new Set(),
      })
    ).toBe(`${computedDebtKey}@${canonical.actionId}`);
  });

  it('keeps handler identity when inserted attributes shift neighboring legacy actions', () => {
    const file = 'src/features/flow-editor/flowEditor.tsx';
    const [action] = parseActions(
      file,
      `<Button data-action-id="flow-editor.toolbar.interactivity.toggle"
        aria-pressed={!isInteractive} onClick={() => setIsInteractive(!isInteractive)} />`
    );
    const historicalKey = `${file}#Button-old-interactivity`;

    expect(
      resolveHistoricalDebtKey({
        file,
        action,
        computedDebtKey: `${file}#${action.legacyActionId}`,
        actionKey: `${file}#${action.actionId}`,
        legacyDebt: new Set([historicalKey]),
        knownLegacyKeys: new Set(),
        resolutions: {
          [historicalKey]: {
            status: 'pending',
            source: { file, tag: 'Button', line: action.line - 30 },
          },
        },
        previousDebtByActionKey: new Map(),
        previousDebtByHandler: new Map([
          [`${file}\u0000setIsInteractive\u0000Button\u0000canonical-action`, historicalKey],
        ]),
        claimedDebtKeys: new Set(),
      })
    ).toBe(historicalKey);
  });

  it('uses an explicit action kind for controls whose selection semantics are hidden by wrappers', () => {
    const [action] = parseActions(
      'src/features/groups/ui/OpenAssignmentsPanel.tsx',
      `<FilterButton data-action-id="groups.assignments.filter.change"
        data-action-kind="selection" onClick={changeFilter}>All</FilterButton>`
    );

    expect(action.kind).toBe('selection');
    expect(action.scenarios).toEqual(['selected', 'unselected', 'keyboard', 'focus']);
  });

  it('keeps colliding legacy fingerprints unique after stable action ids are assigned', () => {
    const file = 'src/features/agendas/ui/ChangeRequestTimelineCardView.tsx';
    const [action] = parseActions(
      file,
      `<Button data-action-id="agendas.change-request.close-vote.open"
        onClick={openConfirmation}>Close vote</Button>`
    );
    const computedDebtKey = `${file}#${action.legacyActionId}`;

    expect(
      resolveHistoricalDebtKey({
        file,
        action,
        computedDebtKey,
        actionKey: `${file}#${action.actionId}`,
        legacyDebt: new Set([computedDebtKey]),
        knownLegacyKeys: new Set(),
        resolutions: {},
        previousDebtByActionKey: new Map(),
        previousDebtByHandler: new Map(),
        claimedDebtKeys: new Set([computedDebtKey]),
      })
    ).toBe(`${computedDebtKey}@agendas.change-request.close-vote.open`);
  });
});
