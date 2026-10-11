import { describe, expect, it } from 'vitest';
import { resultQuery } from './query-result-harness';

describe('relational result harness SQL semantics', () => {
  it('treats missing fixture columns as NULL for IS and IS NOT predicates', () => {
    const source = [
      { id: 'missing' },
      { id: 'null', tutorial_run_id: null },
      { id: 'present', tutorial_run_id: 'run' },
    ];

    expect(resultQuery().where('tutorial_run_id', 'IS', null).run(source)).toEqual([
      { id: 'missing' },
      { id: 'null', tutorial_run_id: null },
    ]);
    expect(resultQuery().where('tutorial_run_id', 'IS NOT', null).run(source)).toEqual([
      { id: 'present', tutorial_run_id: 'run' },
    ]);
    expect(resultQuery().where('tutorial_run_id', '=', null).run(source)).toEqual([]);
  });

  it('projects a child one() result as an object or undefined', () => {
    const query = resultQuery().related('child', (child: any) =>
      child.where('id', 'visible').one()
    );

    expect(query.run([{ id: 'parent', child: { id: 'visible' } }])).toEqual([
      { id: 'parent', child: { id: 'visible' } },
    ]);
    expect(query.run([{ id: 'parent', child: [{ id: 'visible' }, { id: 'other' }] }])).toEqual([
      { id: 'parent', child: { id: 'visible' } },
    ]);
    expect(query.run([{ id: 'parent', child: { id: 'hidden' } }])).toEqual([
      { id: 'parent', child: undefined },
    ]);
  });
});
