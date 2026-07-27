import { describe, expect, it } from 'vitest';
import {
  APP_TUTORIAL_CHECKPOINTS,
  APP_TUTORIAL_CHECKPOINT_IDS,
  APP_TUTORIAL_EXPECTED_INPUTS,
  APP_TUTORIAL_FIXTURE_VERSION,
  APP_TUTORIAL_NETWORK_RIGHT_DIRECTIONS,
  getAppTutorialExpectedInput,
  getAppTutorialCheckpoint,
  getNextAppTutorialCheckpoint,
  matchesAppTutorialExpectedInput,
  matchesTutorialInput,
  resolveAppTutorialRoute,
} from '../catalog';
import { APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION } from '../events';

describe('app tutorial catalog', () => {
  it('uses fixture version 6 for the assistant output checkpoint migration', () => {
    expect(APP_TUTORIAL_FIXTURE_VERSION).toBe(6);
  });

  it('has unique, stable checkpoint ids and bilingual copy', () => {
    expect(new Set(APP_TUTORIAL_CHECKPOINT_IDS).size).toBe(APP_TUTORIAL_CHECKPOINT_IDS.length);
    expect(APP_TUTORIAL_CHECKPOINT_IDS[0]).toBe('primary-navigation');
    expect(APP_TUTORIAL_CHECKPOINT_IDS.at(-1)).toBe('tutorial-complete');

    for (const checkpoint of APP_TUTORIAL_CHECKPOINTS) {
      expect(checkpoint.route).toMatch(/^\//);
      expect(checkpoint.anchor).not.toBe('');
      expect(checkpoint.copy.de.title).not.toBe('');
      expect(checkpoint.copy.de.body).not.toBe('');
      expect(checkpoint.copy.en.title).not.toBe('');
      expect(checkpoint.copy.en.body).not.toBe('');
    }
  });

  it.each(['open-avatar-menu', 'open-settings'] as const)(
    'advances %s only after the avatar menu reports that it opened',
    checkpointId => {
      expect(getAppTutorialCheckpoint(checkpointId)).toMatchObject({
        anchor: 'primary-avatar',
        completion: {
          type: 'action',
          event: APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION,
        },
      });
    }
  );

  it.each([
    ['view-ai-skills', 'settings-ai-skills'],
    ['view-ai-tools', 'settings-ai-tools'],
  ] as const)('uses Continue for the non-interactive %s card', (checkpointId, anchor) => {
    expect(getAppTutorialCheckpoint(checkpointId)).toMatchObject({
      anchor,
      completion: { type: 'view' },
    });
    expect(getAppTutorialCheckpoint(checkpointId).copy.de.instruction).toContain('Weiter');
    expect(getAppTutorialCheckpoint(checkpointId).copy.en.instruction).toContain('Continue');
  });

  it('keeps prescribed fixture text and accepts normalized typography', () => {
    expect(APP_TUTORIAL_EXPECTED_INPUTS.groupSearch).toBe('Initiative Klimafitte Euckenstraße');
    expect(APP_TUTORIAL_EXPECTED_INPUTS.networkGroupSearch).toBe('Münchner Klimarat');
    expect(APP_TUTORIAL_EXPECTED_INPUTS.cityDesignStreet).toBe('Euckenstraße');
    expect(APP_TUTORIAL_EXPECTED_INPUTS.cityDesignHouseNumber).toBe('38');
    expect(APP_TUTORIAL_EXPECTED_INPUTS.votingPassword).toBe('1234');
    expect(
      matchesTutorialInput(
        '  Erstelle mir die Aufgabe "Die Welt zu einem besseren Ort machen". ',
        APP_TUTORIAL_EXPECTED_INPUTS.assistantTodo
      )
    ).toBe(true);
    expect(
      matchesAppTutorialExpectedInput(
        getAppTutorialExpectedInput('assistantTodo', 'en'),
        'assistantTodo'
      )
    ).toBe(true);
  });

  it('resolves entity routes and advances sequentially', () => {
    expect(
      resolveAppTutorialRoute('/amendment/:amendmentId/process', {
        amendmentId: 'a/b',
      })
    ).toBe('/amendment/a%2Fb/process');
    expect(getNextAppTutorialCheckpoint('primary-navigation')?.id).toBe('open-create');
    expect(getNextAppTutorialCheckpoint('tutorial-complete')).toBeNull();
    expect(getAppTutorialCheckpoint('open-home').chapter).toBe(7);
  });

  it('opens membership review immediately after the local request action', () => {
    expect(getAppTutorialCheckpoint('request-membership').completion).toEqual({
      type: 'action',
      event: 'group-membership.requested',
    });
    expect(getAppTutorialCheckpoint('view-membership-request').effect).toBe('accept-membership');
  });

  it('guides the network link through search, hierarchy, rights, and directions', () => {
    expect(APP_TUTORIAL_NETWORK_RIGHT_DIRECTIONS).toEqual({
      outgoing: 'current_grants_right_to_partner',
      incoming: 'partner_grants_right_to_current',
    });
    expect(getAppTutorialCheckpoint('link-climate-council').completion).toEqual({
      type: 'entity-selection',
      expectedEntityAlias: 'climateCouncilGroupId',
    });
    expect(getNextAppTutorialCheckpoint('link-climate-council')?.id).toBe(
      'select-climate-council-child'
    );
    expect(getNextAppTutorialCheckpoint('select-climate-council-child')?.id).toBe(
      'select-climate-council-rights'
    );
    expect(getNextAppTutorialCheckpoint('select-climate-council-rights')?.id).toBe(
      'request-climate-council-rights'
    );
    expect(getAppTutorialCheckpoint('request-climate-council-rights').completion).toEqual({
      type: 'input',
      expectedInputKey: 'networkRightsIncoming',
    });
    expect(getAppTutorialCheckpoint('request-climate-council-rights').anchor).toBe('link-group');
    expect(getNextAppTutorialCheckpoint('request-climate-council-rights')?.id).toBe(
      'create-climate-council-link'
    );
    expect(getAppTutorialCheckpoint('create-climate-council-link').completion).toEqual({
      type: 'click',
    });
    expect(getAppTutorialCheckpoint('create-climate-council-link').anchor).toBe(
      'network-link-create'
    );
    expect(getNextAppTutorialCheckpoint('view-network-pending')?.id).toBe('view-network-confirmed');
    expect(getAppTutorialCheckpoint('view-network-confirmed')).toMatchObject({
      route: '/group/:initiativeGroupId/network?tab=manage-network',
      anchor: 'tutorial-network-confirmed',
      completion: { type: 'view' },
    });
    expect(getNextAppTutorialCheckpoint('view-network-confirmed')?.id).toBe('view-network-flow');
  });

  it('completes the network task on the kanban board and creates suggestions in the editor', () => {
    const completeNetworkTodo = getAppTutorialCheckpoint('complete-network-todo');
    expect(completeNetworkTodo.route).toBe('/todos');
    expect(completeNetworkTodo.anchor).toBe('tutorial-network-todo-board');
    expect(completeNetworkTodo.completion).toEqual({ type: 'drop', event: 'todo.completed' });
    expect(completeNetworkTodo.copy.de.instruction).toContain('Ziehe');
    expect(completeNetworkTodo.copy.en.instruction).toContain('Drag');

    const createChangeRequest = getAppTutorialCheckpoint('create-change-request');
    expect(createChangeRequest.anchor).toBe('amendment-text-editor');
    expect(createChangeRequest.completion).toEqual({
      type: 'action',
      event: 'change-request.created',
      expectedInputKey: 'changeRequestText',
    });
    expect(createChangeRequest.copy.de.instruction).toContain(
      APP_TUTORIAL_EXPECTED_INPUTS.changeRequestText
    );
    expect(createChangeRequest.copy.en.instruction).toContain(
      APP_TUTORIAL_EXPECTED_INPUTS.changeRequestText
    );

    expect(getAppTutorialCheckpoint('vote-change-request')).toMatchObject({
      route: '/amendment/:amendmentId/text',
      anchor: 'tutorial-change-request-editor-trigger',
      completion: { type: 'click' },
    });
    expect(getNextAppTutorialCheckpoint('vote-change-request')?.id).toBe('accept-change-request');
    expect(getAppTutorialCheckpoint('accept-change-request')).toMatchObject({
      route: '/amendment/:amendmentId/text',
      anchor: 'tutorial-change-request-accept',
      completion: { type: 'mutation', event: 'change-request.voted' },
      effect: 'accept-reviewed-change-request',
    });
    expect(getNextAppTutorialCheckpoint('accept-change-request')?.id).toBe('open-change-requests');
  });

  it('offers the exact prescribed text for clipboard actions', () => {
    expect(
      APP_TUTORIAL_CHECKPOINTS.filter(checkpoint => checkpoint.copyText).map(checkpoint => [
        checkpoint.id,
        checkpoint.copyText,
      ])
    ).toEqual([
      ['search-initiative', APP_TUTORIAL_EXPECTED_INPUTS.groupSearch],
      ['link-climate-council', APP_TUTORIAL_EXPECTED_INPUTS.networkGroupSearch],
      ['edit-amendment-text', APP_TUTORIAL_EXPECTED_INPUTS.amendmentAddition],
      ['create-change-request', APP_TUTORIAL_EXPECTED_INPUTS.changeRequestText],
      ['create-amendment-path', APP_TUTORIAL_EXPECTED_INPUTS.groupSearch],
      ['select-amendment-path-target', APP_TUTORIAL_EXPECTED_INPUTS.networkGroupSearch],
      ['submit-amendment-vote', APP_TUTORIAL_EXPECTED_INPUTS.votingPassword],
      ['submit-election-vote', APP_TUTORIAL_EXPECTED_INPUTS.votingPassword],
      ['ask-assistant-for-todo', APP_TUTORIAL_EXPECTED_INPUTS.assistantTodo],
    ]);
  });

  it('recognizes the amendment addition as direct input evidence', () => {
    expect(getAppTutorialCheckpoint('edit-amendment-text').completion).toEqual({
      type: 'input',
      expectedInputKey: 'amendmentAddition',
    });
  });

  it('builds the amendment process from start group through explicit confirmation', () => {
    expect(getAppTutorialCheckpoint('create-amendment-path')).toMatchObject({
      anchor: 'tutorial-process-start-group',
      completion: {
        type: 'entity-selection',
        expectedEntityAlias: 'initiativeGroupId',
      },
    });
    expect(getNextAppTutorialCheckpoint('create-amendment-path')?.id).toBe(
      'select-amendment-path-target'
    );
    expect(getAppTutorialCheckpoint('select-amendment-path-target')).toMatchObject({
      anchor: 'tutorial-process-target-group',
      completion: {
        type: 'entity-selection',
        expectedEntityAlias: 'climateCouncilGroupId',
      },
    });
    expect(getNextAppTutorialCheckpoint('select-amendment-path-target')?.id).toBe(
      'review-amendment-process-path'
    );
    expect(getAppTutorialCheckpoint('review-amendment-process-path')).toMatchObject({
      anchor: 'tutorial-process-path-review',
      completion: { type: 'view' },
    });
    expect(getNextAppTutorialCheckpoint('review-amendment-process-path')?.id).toBe(
      'confirm-amendment-process'
    );
    expect(getAppTutorialCheckpoint('confirm-amendment-process')).toMatchObject({
      anchor: 'tutorial-confirm-process-path',
      completion: { type: 'mutation', event: 'amendment-process.started' },
    });
  });

  it('guides City Design before switching to suggestion mode', () => {
    const chapterSixIds = APP_TUTORIAL_CHECKPOINTS.filter(
      checkpoint => checkpoint.chapter === 6
    ).map(checkpoint => checkpoint.id);

    expect(chapterSixIds.slice(0, 12)).toEqual([
      'edit-amendment-text',
      'open-city-design',
      'open-city-design-map-selection',
      'select-city-design-address',
      'load-city-design-osm',
      'open-city-design-trees',
      'select-city-design-deciduous',
      'add-tree-row',
      'save-city-design',
      'return-amendment-text',
      'switch-suggest-internal',
      'create-change-request',
    ]);
    expect(getAppTutorialCheckpoint('select-city-design-address')).toMatchObject({
      anchor: 'city-design-location-search',
      completion: { type: 'action', event: 'city-design.location-selected' },
      copyTexts: [
        APP_TUTORIAL_EXPECTED_INPUTS.cityDesignStreet,
        APP_TUTORIAL_EXPECTED_INPUTS.cityDesignHouseNumber,
      ],
    });
    expect(getAppTutorialCheckpoint('load-city-design-osm')).toMatchObject({
      anchor: 'city-design-load-osm',
      completion: { type: 'action', event: 'city-design.osm-loaded' },
    });
    expect(getAppTutorialCheckpoint('add-tree-row').anchor).toBe(
      'city-design-tree-placement-workspace'
    );
  });

  it('guides amendment and election voting through the real agenda detail controls', () => {
    expect(
      APP_TUTORIAL_CHECKPOINTS.filter(checkpoint => checkpoint.chapter === 8).map(
        checkpoint => checkpoint.id
      )
    ).toEqual([
      'open-amendment-agenda-item',
      'review-amendment-change-requests',
      'open-amendment-agenda-vote',
      'select-amendment-yes',
      'confirm-amendment-vote',
      'submit-amendment-vote',
      'view-amendment-result',
      'open-election-agenda-item',
      'review-election-options',
      'open-election-agenda-vote',
      'select-election-option',
      'confirm-election-vote',
      'submit-election-vote',
      'view-election-result',
    ]);

    expect(getAppTutorialCheckpoint('confirm-amendment-vote')).toMatchObject({
      anchor: 'agenda-amendment-submit',
      completion: { type: 'click' },
    });
    expect(getAppTutorialCheckpoint('submit-amendment-vote')).toMatchObject({
      anchor: 'agenda-amendment-password',
      completion: { type: 'mutation', event: 'agenda-amendment.voted' },
      effect: 'cast-simulated-amendment-votes',
      copyText: APP_TUTORIAL_EXPECTED_INPUTS.votingPassword,
    });
    expect(getAppTutorialCheckpoint('confirm-election-vote')).toMatchObject({
      anchor: 'agenda-election-submit',
      completion: { type: 'click' },
    });
    expect(getAppTutorialCheckpoint('submit-election-vote')).toMatchObject({
      route: '/event/:firstEventId/agenda/:electionAgendaItemId',
      anchor: 'agenda-election-password',
      completion: { type: 'mutation', event: 'agenda-election.voted' },
      effect: 'cast-simulated-election-votes',
      copyText: APP_TUTORIAL_EXPECTED_INPUTS.votingPassword,
    });
    expect(getNextAppTutorialCheckpoint('view-election-result')?.id).toBe('open-settings');
    expect(getAppTutorialCheckpoint('open-todos')).toMatchObject({
      route: '/messages',
      anchor: 'tutorial-assistant-todo-output',
      completion: { type: 'click' },
      chapter: 12,
    });
    expect(getAppTutorialCheckpoint('open-assistant-todo')).toMatchObject({
      route: '/todos',
      anchor: 'tutorial-assistant-todo',
      completion: { type: 'view' },
    });
    expect(getAppTutorialCheckpoint('start-assistant-todo')).toMatchObject({
      route: '/todos',
      anchor: 'tutorial-assistant-todo-board',
      completion: { type: 'mutation', event: 'todo.in-progress' },
    });
    expect(getAppTutorialCheckpoint('permanent-help').route).toBe('/todos');
    expect(getAppTutorialCheckpoint('tutorial-complete').copy.de.body).toBe(
      'Polity hat noch viel mehr Features. Erkunde sie. Mach die Welt mit uns und deinen Gleichgesinnten zu einem besseren Ort – ob lokal, national oder transnational. Vernetze dich in Polity mit Menschen und verändere die Welt!'
    );
  });
});
