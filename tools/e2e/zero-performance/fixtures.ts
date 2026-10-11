import { required } from './required';
import type { Sql } from 'postgres';
import { schema } from '../../../src/zero/schema';
import { FIXTURE_ID, FIXTURE_NOW, OWNER_ID, OUTSIDER_ID } from './catalog';
import type { AST } from './oracle';

export interface Column {
  type: string;
  nullable: boolean;
  default: string | null;
}
interface ForeignKey {
  columns: string[];
  target: string;
  targetColumns: string[];
}
interface RecordPlan {
  table: string;
  values: Record<string, unknown>;
}
const ownFields = new Set([
  'owner_id',
  'creator_id',
  'created_by_id',
  'user_id',
  'author_id',
  'actor_id',
  'sender_id',
  'recipient_id',
]);

/** Only mandatory scalar equalities may bind a correlated parent key. */
function boundEquality(where: any, column: string): unknown {
  if (!where) return undefined;
  if (where.type === 'and') {
    const values = where.conditions
      .map((condition: any) => boundEquality(condition, column))
      .filter((value: unknown) => value !== undefined);
    if (values.some((value: unknown) => value !== values[0]))
      throw new Error(`Conflicting correlated child equalities for ${column}`);
    return values[0];
  }
  if (
    where.type === 'simple' &&
    where.op === '=' &&
    where.left?.type === 'column' &&
    where.left.name === column &&
    where.right?.type === 'literal' &&
    where.right.value !== null
  )
    return where.right.value;
  return undefined;
}
export class Fixtures {
  readonly columns = new Map<string, Map<string, Column>>();
  private foreignKeys = new Map<string, ForeignKey[]>();
  private enums = new Map<string, string[]>();
  private checks = new Map<string, string[]>();
  private primaryKeys = new Map<string, string[]>();
  private uniqueKeys = new Map<string, string[][]>();
  private snapshots: RecordPlan[] = [];
  private inserted: RecordPlan[] = [];
  private deferred: RecordPlan[] = [];
  private userSnapshot: Record<string, unknown> | undefined;
  constructor(readonly sql: Sql) {}

  async inspect() {
    const columns = await this
      .sql`select table_name, column_name, data_type, is_nullable, column_default, udt_name from information_schema.columns where table_schema = 'public'`;
    for (const c of columns) {
      if (!this.columns.has(c.table_name)) this.columns.set(c.table_name, new Map());
      required(this.columns.get(c.table_name)).set(c.column_name, {
        type: c.data_type === 'USER-DEFINED' ? c.udt_name : c.data_type,
        nullable: c.is_nullable === 'YES',
        default: c.column_default,
      });
    }
    for (const key of await this
      .sql`select rel.relname as table_name, array(select attname from pg_attribute where attrelid=c.conrelid and attnum=any(c.conkey) order by array_position(c.conkey,attnum)) as keys from pg_constraint c join pg_class rel on rel.oid=c.conrelid where c.contype='p' and c.connamespace='public'::regnamespace`)
      this.primaryKeys.set(key.table_name, key.keys);
    for (const key of await this
      .sql`select rel.relname as table_name, array(select attname from pg_attribute where attrelid=i.indrelid and attnum=any(i.indkey) order by array_position(i.indkey,attnum)) as keys from pg_index i join pg_class rel on rel.oid=i.indrelid join pg_namespace n on n.oid=rel.relnamespace where i.indisunique and i.indpred is null and i.indexprs is null and n.nspname='public'`)
      this.uniqueKeys.set(key.table_name, [
        ...(this.uniqueKeys.get(key.table_name) ?? []),
        key.keys,
      ]);
    const foreignKeys = await this.sql`select src.relname as source, dst.relname as target,
      array(select attname from pg_attribute where attrelid = c.conrelid and attnum = any(c.conkey) order by array_position(c.conkey,attnum)) as columns,
      array(select attname from pg_attribute where attrelid = c.confrelid and attnum = any(c.confkey) order by array_position(c.confkey,attnum)) as target_columns,
      n.nspname as target_schema
      from pg_constraint c join pg_class src on src.oid=c.conrelid join pg_class dst on dst.oid=c.confrelid join pg_namespace n on n.oid=dst.relnamespace
      where c.contype='f' and c.connamespace='public'::regnamespace`;
    for (const fk of foreignKeys) {
      if (fk.target_schema !== 'public') continue;
      const list = this.foreignKeys.get(fk.source) ?? [];
      list.push({ columns: fk.columns, target: fk.target, targetColumns: fk.target_columns });
      this.foreignKeys.set(fk.source, list);
    }
    // Search-index triggers reference these parents even where the source table has no FK.
    for (const table of ['event', 'amendment', 'todo', 'blog', 'timeline_event']) {
      const list = this.foreignKeys.get(table) ?? [];
      if (!list.some(fk => fk.columns.includes('group_id')))
        list.push({ columns: ['group_id'], target: 'group', targetColumns: ['id'] });
      this.foreignKeys.set(table, list);
    }
    for (const e of await this
      .sql`select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid order by e.enumsortorder`) {
      this.enums.set(e.typname, [...(this.enums.get(e.typname) ?? []), e.enumlabel]);
    }
    for (const c of await this
      .sql`select rel.relname, pg_get_constraintdef(c.oid) as expression from pg_constraint c join pg_class rel on rel.oid=c.conrelid where c.contype='c' and c.connamespace='public'::regnamespace`) {
      this.checks.set(c.relname, [...(this.checks.get(c.relname) ?? []), c.expression]);
    }
  }

  private baseline(table: string, field: string, column: Column): unknown {
    if (field === 'id') return FIXTURE_ID;
    if (ownFields.has(field) || field.endsWith('_user_id')) return OWNER_ID;
    if (field === 'visibility') return 'private';
    if (field === 'handle') return 'benchmark';
    if (/timestamp/.test(column.type)) return new Date(FIXTURE_NOW);
    if (this.enums.has(column.type)) return required(this.enums.get(column.type))[0];
    for (const check of this.checks.get(table) ?? []) {
      const match = check.match(
        new RegExp(`\\b${field}\\b\\s*=\\s*ANY\\s*\\(ARRAY\\[(.*?)\\]`, 'i')
      );
      if (match) {
        const value = match[1].match(/'((?:[^']|'')*)'/)?.[1];
        if (value !== undefined) return value.replaceAll("''", "'");
      }
    }
    if (column.type === 'uuid') return FIXTURE_ID;
    if (/boolean/.test(column.type)) return false;
    if (/json/.test(column.type)) return {};
    if (/integer|numeric|real|double|bigint/.test(column.type)) return 0;
    if (column.type === 'ARRAY') return [];
    if (column.type === 'date') return '2027-01-15';
    return 'benchmark';
  }

  plan(ast: AST) {
    const records = new Map<string, RecordPlan>();
    let sequence = 10;
    function id() {
      return `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
    }
    const physical = (name: string) => (schema.tables as any)[name]?.serverName ?? name;
    const field = (name: string, key: string) =>
      (schema.tables as any)[name]?.columns[key]?.serverName ?? key;
    const plan = (
      node: AST,
      initial: Record<string, unknown>,
      path: string,
      includeRelated = true
    ): RecordPlan => {
      const table = physical(node.table);
      const primary =
        initial.id ?? (table === 'user' ? OWNER_ID : path === 'root' ? FIXTURE_ID : id());
      const key = `${table}:${primary}`;
      const record: RecordPlan = records.get(key) ?? { table, values: { id: primary } };
      records.set(key, record);
      Object.assign(record.values, initial);
      const set = (column: string, value: unknown) => {
        const physical = field(node.table, column);
        if (value === null && required(this.columns.get(table)).get(physical)?.nullable === false)
          throw new Error(`Nonnullable positive predicate ${table}.${physical}`);
        if (table === 'notification' && value !== null) {
          if (
            physical === 'recipient_id' &&
            (record.values.recipient_entity_id != null ||
              record.values.recipient_entity_type != null ||
              ['group', 'event', 'amendment', 'blog'].some(
                target => record.values[`recipient_${target}_id`] != null
              ))
          )
            throw new Error('Notification target conflicts with direct recipient');
          if (
            /^recipient_(group|event|amendment|blog)_id$/.test(physical) &&
            record.values.recipient_id != null
          )
            throw new Error('Notification direct recipient conflicts with entity target');
        }
        if (physical in record.values && record.values[physical] !== value)
          throw new Error(`Conflicting fixture predicates ${table}.${physical}`);
        record.values[physical] = value;
      };
      const related = (
        relationship: any,
        child: AST,
        childInitial: Record<string, unknown> = {},
        requiredRelation = false
      ) => {
        if (
          relationship.correlation.parentField.some(
            (parent: string) => record.values[field(node.table, parent)] === null
          )
        ) {
          if (requiredRelation)
            throw new Error(`Required relation conflicts with null parent in ${table}`);
          return;
        }
        if (
          relationship.correlation.parentField.some((parent: string, index: number) => {
            const key = field(node.table, parent);
            return (
              !(key in record.values) &&
              this.columns.get(table)?.get(key)?.nullable &&
              relationship.correlation.childField[index] === 'id'
            );
          }) &&
          !requiredRelation
        )
          return;
        const initial = { ...childInitial };
        relationship.correlation.parentField.forEach((parent: string, index: number) => {
          const parentColumn = field(node.table, parent);
          const childColumn = field(child.table, relationship.correlation.childField[index]);
          if (
            table === 'notification' &&
            /^recipient_(group|event|amendment|blog)_id$/.test(parentColumn) &&
            record.values.recipient_entity_id != null
          )
            record.values[parentColumn] ??= record.values.recipient_entity_id;
          record.values[parentColumn] ??=
            boundEquality(child.where, relationship.correlation.childField[index]) ??
            (parentColumn === 'id' ? primary : child.table === 'user' ? OWNER_ID : id());
          initial[childColumn] = record.values[parentColumn];
        });
        return plan(child, initial, `${path}.${child.table}`, false);
      };
      const condition = (where: any) => {
        if (!where) return;
        if (where.type === 'and') {
          const containsExists = (value: any): boolean =>
            value.type === 'correlatedSubquery' || Boolean(value.conditions?.some(containsExists));
          const rank = (value: any) =>
            value.type === 'simple'
              ? 0
              : value.type === 'correlatedSubquery'
                ? 1
                : containsExists(value)
                  ? 2
                  : 1;
          [...where.conditions].sort((a: any, b: any) => rank(a) - rank(b)).forEach(condition);
          return;
        }
        if (where.type === 'or') {
          const owner = where.conditions.find(
            (c: any) =>
              c.type === 'simple' && ownFields.has(c.left?.name) && c.right?.value === OWNER_ID
          );
          const alternatives = owner
            ? [owner, ...where.conditions.filter((c: unknown) => c !== owner)]
            : where.conditions;
          for (const alternative of alternatives) {
            const snapshot = [...records].map(
              ([key, value]) => [key, value, { ...value.values }] as const
            );
            try {
              condition(alternative);
              return;
            } catch {
              records.clear();
              for (const [key, value, original] of snapshot) {
                value.values = original;
                records.set(key, value);
              }
            }
          }
          throw new Error(`No satisfiable positive branch for ${table}`);
        }
        if (where.type === 'correlatedSubquery') {
          if (where.op === 'EXISTS') related(where.related, where.related.subquery, {}, true);
          else if (where.op !== 'NOT EXISTS') throw new Error(`Unsupported fixture ${where.op}`);
          return;
        }
        if (
          where.type !== 'simple' ||
          where.left.type !== 'column' ||
          where.right.type !== 'literal'
        )
          throw new Error('Fixture requires explicit support for this predicate');
        const value = where.right.value;
        switch (where.op) {
          case '=':
          case 'IS':
            set(where.left.name, value);
            break;
          case 'IN':
            if (!value.length) throw new Error('Positive fixture cannot satisfy empty IN');
            set(where.left.name, value[0]);
            break;
          case '>':
            set(
              where.left.name,
              typeof value === 'number' ? value + (value > 1e12 ? 86_400_000 : 1) : `${value}z`
            );
            break;
          case '>=':
          case '<=':
            set(where.left.name, value);
            break;
          case '<':
            set(where.left.name, typeof value === 'number' ? value - 1 : '');
            break;
          case 'LIKE':
          case 'ILIKE':
            set(where.left.name, String(value).replaceAll('%', '').replaceAll('_', 'x'));
            break;
          case '!=':
          case 'IS NOT':
          case 'NOT IN':
          case 'NOT LIKE':
          case 'NOT ILIKE': {
            const key = field(node.table, where.left.name);
            const existing = key in record.values;
            const column = required(required(this.columns.get(table)).get(key));
            if (!existing) record.values[key] = this.baseline(table, key, column);
            const banned = where.op === 'NOT IN' ? value : [value];
            if (banned.includes(record.values[key])) {
              if (existing)
                throw new Error(`Negative fixture predicate conflicts for ${table}.${key}`);
              record.values[key] =
                column.type === 'uuid'
                  ? '40000000-0000-4000-8000-000000000001'
                  : typeof value === 'number'
                    ? value + 1
                    : 'benchmark-other';
            }
            break;
          }
          default:
            throw new Error(`Unsupported fixture operator ${where.op}`);
        }
      };
      condition(node.where);
      if (includeRelated)
        for (const relationship of node.related ?? []) related(relationship, relationship.subquery);
      return record;
    };
    const root = plan({ ...ast, start: undefined }, {}, 'root');
    // Pagination cursors refer to a real allowed row, including its sort keys.
    if (ast.start)
      for (const [key] of ast.orderBy ?? []) {
        const value = ast.start.row[key];
        if (value === undefined) throw new Error(`Missing real cursor field ${key}`);
        root.values[field(ast.table, key)] = value;
      }
    // Parent objects required by SQL foreign keys retain all database integrity rules.
    for (const record of records.values()) {
      const columns = this.columns.get(record.table);
      if (!columns) throw new Error(`No database metadata for ${record.table}`);
      if (columns.has('visibility') && !('visibility' in record.values))
        record.values.visibility = 'private';
      if (['group_connection', 'group_connection_request'].includes(record.table)) {
        record.values.group_a_id ??= '00000000-0000-4000-8000-000000000001';
        record.values.group_b_id ??= '40000000-0000-4000-8000-000000000001';
      }
      for (const [key, column] of columns) {
        if (!(key in record.values) && !column.nullable && column.default === null)
          record.values[key] = this.baseline(record.table, key, column);
      }
      if (
        record.table === 'statement' &&
        !['title', 'text', 'image_url', 'video_url'].some(key => record.values[key])
      )
        record.values.text = 'benchmark';
      if (record.table === 'studio_project') record.values.owner_id ??= OWNER_ID;
      // populate_search_document_location fills group_id from entity_id before
      // insertion. Plan that real parent so the enabled FK/trigger can succeed.
      if (
        record.table === 'search_document' &&
        record.values.entity_type === 'group' &&
        !('group_id' in record.values)
      ) {
        record.values.group_id = record.values.entity_id;
        const key = `group:${record.values.entity_id}`;
        if (!records.has(key))
          records.set(key, {
            table: 'group',
            values: {
              id: record.values.entity_id,
              visibility: record.values.visibility,
              owner_id: record.values.owner_user_id ?? OWNER_ID,
              name: record.values.title ?? record.values.search_text ?? 'benchmark',
            },
          });
      }
      if (record.table === 'notification') {
        const targets = ['group', 'event', 'amendment', 'blog'];
        const entity = record.values.recipient_id
          ? undefined
          : targets.find(target => record.values[`recipient_${target}_id`]);
        if (entity) {
          record.values.recipient_id = null;
          record.values.recipient_entity_type = entity;
          record.values.recipient_entity_id = record.values[`recipient_${entity}_id`];
          for (const target of targets)
            if (target !== entity) record.values[`recipient_${target}_id`] = null;
        } else {
          record.values.recipient_id ??= OWNER_ID;
          for (const key of [
            'recipient_entity_type',
            'recipient_entity_id',
            ...targets.map(target => `recipient_${target}_id`),
          ])
            record.values[key] = null;
        }
      }
      if (record.table === 'calendar_subscription') {
        const target = record.values.target_user_id ? 'user' : 'group';
        record.values.target_type = target;
        record.values[target === 'group' ? 'target_group_id' : 'target_user_id'] ??=
          target === 'group' ? FIXTURE_ID : OWNER_ID;
        record.values[target === 'group' ? 'target_user_id' : 'target_group_id'] = null;
      }
      if (record.table === 'appearance_theme') {
        if (['builtin', 'personal'].includes(String(record.values.kind)))
          record.values.group_id = null;
        else {
          record.values.kind = 'group';
          record.values.group_id ??= FIXTURE_ID;
        }
      }
      for (const key of ['version', 'width', 'height', 'byte_size'])
        if (
          columns.has(key) &&
          (record.table.startsWith('studio_') || record.table === 'appearance_theme_revision') &&
          Number(record.values[key] ?? 0) <= 0
        )
          record.values[key] = 1;
      if (['group_connection', 'group_connection_request'].includes(record.table)) {
        record.values.group_a_id ??= FIXTURE_ID;
        record.values.group_b_id ??= '40000000-0000-4000-8000-000000000001';
        if (String(record.values.group_a_id) >= String(record.values.group_b_id)) {
          const first = record.values.group_a_id;
          record.values.group_a_id = record.values.group_b_id;
          record.values.group_b_id = first;
        }
        if (record.values.group_a_id === record.values.group_b_id)
          record.values.group_b_id = '40000000-0000-4000-8000-000000000001';
        const type =
          record.table === 'group_connection_request'
            ? 'desired_connection_type'
            : 'connection_type';
        const parent =
          record.table === 'group_connection_request'
            ? 'desired_parent_group_id'
            : 'parent_group_id';
        const child =
          record.table === 'group_connection_request' ? 'desired_child_group_id' : 'child_group_id';
        if (record.values[parent] || record.values[child] || record.values[type] === 'hierarchy') {
          record.values[type] = 'hierarchy';
          record.values[parent] = record.values.group_a_id;
          record.values[child] = record.values.group_b_id;
        } else record.values[type] = 'peer';
      }
      for (const [table, left, right] of [
        ['group_right_grant', 'holder_group_id', 'scope_group_id'],
        ['group_right_grant_request', 'holder_group_id', 'scope_group_id'],
        ['group_membership_rule', 'member_source_group_id', 'member_target_group_id'],
        ['group_membership_rule_request', 'member_source_group_id', 'member_target_group_id'],
      ]) {
        if (record.table === table && record.values[left] === record.values[right])
          record.values[right] = '40000000-0000-4000-8000-000000000001';
      }
      if (
        ['group_membership_rule', 'group_membership_rule_request'].includes(record.table) &&
        record.values.required_source_role_id != null
      )
        record.values.membership_mode = 'role_members';
      if (record.table === 'group_membership_rule_request') {
        if (record.values.operation === 'remove')
          for (const key of [
            'member_source_group_id',
            'member_target_group_id',
            'membership_mode',
            'required_source_role_id',
          ])
            record.values[key] = null;
        else {
          record.values.operation = 'upsert';
          record.values.member_source_group_id ??= FIXTURE_ID;
          record.values.member_target_group_id ??= '40000000-0000-4000-8000-000000000001';
          record.values.membership_mode ??= 'all_members';
        }
      }
      if (
        record.table === 'timeline_event' &&
        (record.values.entity_type === 'group' || record.values.content_type === 'group')
      )
        record.values.group_id = record.values.entity_id ?? record.values.id;
      for (const fk of this.foreignKeys.get(record.table) ?? []) {
        if (fk.columns.some(c => record.values[c] == null)) continue;
        const initial = Object.fromEntries(
          fk.targetColumns.map((c, i) => [c, record.values[fk.columns[i]]])
        );
        if (fk.target === 'user') {
          for (const c of fk.columns)
            if (![OWNER_ID, OUTSIDER_ID].includes(String(record.values[c])))
              record.values[c] = OWNER_ID;
          continue;
        }
        const key = `${fk.target}:${initial.id}`;
        if (!records.has(key)) records.set(key, { table: fk.target, values: initial });
      }
      if (!columns.has('id')) delete record.values.id;
    }
    return {
      root,
      users: [...records.values()].filter(r => r.table === 'user'),
      records: [...records.values()].filter(r => r.table !== 'user'),
    };
  }

  async seed(ast: AST) {
    const { root, records, users } = this.plan(ast);
    for (const user of users) {
      if (user.values.id !== OWNER_ID)
        throw new Error('Positive user fixture requires the provisioned owner identity');
      const [current] = await this.sql`select * from public."user" where id=${OWNER_ID}`;
      if (!current) throw new Error('Missing fixture actor');
      this.userSnapshot = current;
      const changes = { ...user.values };
      delete changes.id;
      if (Object.keys(changes).length)
        await this.sql`update public."user" set ${this.sql(changes)} where id=${OWNER_ID}`;
    }
    const pending = [...records];
    // Nullable backlinks are filled after parents exist; constraints and triggers stay enabled.
    while (pending.length) {
      const dependencies = (record: RecordPlan) =>
        (this.foreignKeys.get(record.table) ?? []).filter(fk =>
          pending.some(
            parent =>
              parent !== record &&
              parent.table === fk.target &&
              fk.targetColumns.every((c, i) => parent.values[c] === record.values[fk.columns[i]])
          )
        );
      const ready =
        pending.find(record => !dependencies(record).length) ??
        pending.find(record =>
          dependencies(record).every(fk =>
            fk.columns.every(
              key => required(required(this.columns.get(record.table)).get(key)).nullable
            )
          )
        );
      if (!ready)
        throw new Error(
          `Cyclic positive fixture needs explicit catalog support: ${pending.map(r => r.table).join(', ')}`
        );
      const columns = required(this.columns.get(ready.table));
      const values = Object.fromEntries(
        Object.entries(ready.values).map(([key, value]) => [
          key,
          /timestamp/.test(columns.get(key)?.type ?? '') && typeof value === 'number'
            ? new Date(value)
            : value,
        ])
      );
      const keyFields = required(this.primaryKeys.get(ready.table));
      const delayed: Record<string, unknown> = Object.fromEntries(
        keyFields.map(key => [key, ready.values[key]])
      );
      for (const fk of dependencies(ready))
        for (const key of fk.columns) {
          delayed[key] = values[key];
          values[key] = null;
        }
      try {
        const inserted = await this
          .sql`insert into ${this.sql(`public.${ready.table}`)} ${this.sql(values)} on conflict do nothing returning *`;
        if (inserted.length) this.inserted.push(ready);
        else {
          let existing = await this.selectRecord(ready);
          if (!existing.length) {
            for (const keys of this.uniqueKeys.get(ready.table) ?? []) {
              if (keys.some(key => ready.values[key] == null)) continue;
              const where = keys
                .map((key, index) => `"${key.replaceAll('"', '""')}" = $${index + 1}`)
                .join(' AND ');
              existing = await this.sql.unsafe(
                `select * from public."${ready.table.replaceAll('"', '""')}" where ${where}`,
                keys.map(key => ready.values[key]) as never[]
              );
              if (existing.length) break;
            }
          }
          if (!existing.length) throw new Error('Fixture conflicts with an unsupported unique key');
          const current = existing[0];
          this.snapshots.push({ table: ready.table, values: current });
          for (const key of keyFields) {
            const before = ready.values[key];
            const after = current[key];
            if (before !== after)
              for (const dependent of records)
                for (const fk of this.foreignKeys.get(dependent.table) ?? [])
                  if (fk.target === ready.table)
                    fk.targetColumns.forEach((target, index) => {
                      if (target === key && dependent.values[fk.columns[index]] === before)
                        dependent.values[fk.columns[index]] = after;
                    });
            ready.values[key] = after;
          }
          await this.updateRecord(ready);
        }
      } catch (error) {
        throw new Error(
          `Fixture ${ready.table}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error }
        );
      }
      pending.splice(pending.indexOf(ready), 1);
      if (Object.keys(delayed).length > keyFields.length)
        this.deferred.push({ table: ready.table, values: delayed });
    }
    for (const record of this.deferred) {
      await this.updateRecord(record);
    }
    if (root.table === 'search_document' && root.values.entity_type === 'group') {
      const [source] = await this.sql`
        select d.visibility = g.visibility as matching_visibility,
          d.owner_user_id is not distinct from g.owner_id as matching_owner
        from public.search_document d join public."group" g on g.id=d.entity_id
        where d.id=${String(root.values.id)}`;
      if (!source?.matching_visibility || !source.matching_owner)
        throw new Error('Search fixture differs from its real group visibility or ownership');
    }
    const keys = required(this.primaryKeys.get(root.table));
    return keys.length === 1
      ? String(root.values[keys[0]])
      : JSON.stringify(keys.map(key => String(root.values[key])));
  }

  private where(record: RecordPlan) {
    const keys = required(this.primaryKeys.get(record.table));
    return {
      text: keys
        .map((key, index) => `"${key.replaceAll('"', '""')}" = $${index + 1}`)
        .join(' AND '),
      values: keys.map(key => record.values[key]),
    };
  }
  private selectRecord(record: RecordPlan) {
    const where = this.where(record);
    return this.sql.unsafe(
      `select * from public."${record.table.replaceAll('"', '""')}" where ${where.text}`,
      where.values as never[]
    );
  }
  private updateRecord(record: RecordPlan) {
    const keys = required(this.primaryKeys.get(record.table));
    const changes = Object.keys(record.values).filter(key => !keys.includes(key));
    if (!changes.length) return Promise.resolve();
    const quoted = (key: string) => `"${key.replaceAll('"', '""')}"`;
    const assignments = changes.map((key, index) => `${quoted(key)}=$${index + 1}`).join(',');
    const where = keys
      .map((key, index) => `${quoted(key)}=$${changes.length + index + 1}`)
      .join(' AND ');
    return this.sql.unsafe(
      `update public.${quoted(record.table)} set ${assignments} where ${where}`,
      [...changes, ...keys].map(key => record.values[key]) as never[]
    );
  }

  async cleanup() {
    const errors: unknown[] = [];
    for (const record of this.deferred.splice(0)) {
      const keys = required(this.primaryKeys.get(record.table));
      const values = Object.fromEntries(
        Object.entries(record.values).map(([key, value]) => [
          key,
          keys.includes(key) ? value : null,
        ])
      );
      try {
        await this.updateRecord({ ...record, values });
      } catch (error) {
        errors.push(error);
      }
    }
    for (const snapshot of this.snapshots.splice(0).reverse())
      try {
        await this.updateRecord(snapshot);
      } catch (error) {
        errors.push(error);
      }
    for (const record of this.inserted.splice(0).reverse()) {
      try {
        const where = this.where(record);
        await this.sql.unsafe(
          `delete from public."${record.table.replaceAll('"', '""')}" where ${where.text}`,
          where.values as never[]
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (this.userSnapshot) {
      const values = this.userSnapshot;
      this.userSnapshot = undefined;
      const changes = { ...values };
      delete changes.id;
      try {
        await this.sql`update public."user" set ${this.sql(changes)} where id=${OWNER_ID}`;
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(
        errors,
        'Fixture cleanup failed; refusing to measure contaminated data'
      );
  }
}
