import { table, string, number } from '@rocicorp/zero';

export const appTutorialRun = table('app_tutorial_run')
  .columns({
    id: string(),
    user_id: string(),
    status: string(),
    current_checkpoint_id: string(),
    fixture_version: number(),
    revision: number(),
    started_at: number(),
    last_activity_at: number(),
    expires_at: number(),
  })
  .primaryKey('id');

export const appTutorialCheckpointEffect = table('app_tutorial_checkpoint_effect')
  .columns({
    run_id: string(),
    checkpoint_id: string(),
    effect_key: string(),
    applied_at: number(),
  })
  .primaryKey('run_id', 'checkpoint_id', 'effect_key');

export const appTutorialEntity = table('app_tutorial_entity')
  .columns({
    run_id: string(),
    alias: string(),
    entity_type: string(),
    entity_id: string(),
  })
  .primaryKey('run_id', 'alias');
