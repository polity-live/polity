import { describe, expect, it } from 'vitest';
import {
  captureScanStatus,
  instrumentStatement,
  SCAN_STATUS_PROTOCOL,
} from '../sqlite-scan-status.mjs';
import { validateScanStatus } from '../scan-status-artifacts';

const constants = {
  SQLITE_SCANSTAT_NVISIT: 1,
  SQLITE_SCANSTAT_NAME: 2,
  SQLITE_SCANSTAT_EXPLAIN: 3,
  SQLITE_SCANSTAT_SELECTID: 4,
  SQLITE_SCANSTAT_PARENTID: 5,
  SQLITE_SCANSTAT_COMPLEX: 1,
};
function fixture() {
  const loop = {
    raw: 3,
    name: 'idx',
    explain: 'SEARCH t USING INDEX idx',
    selectID: 2,
    parentID: 0,
  };
  const complex: any[] = [
    { raw: -1, name: undefined, explain: 'MULTI-INDEX OR', selectID: 1, parentID: 0 },
    { ...loop },
    { raw: 3, name: undefined, explain: 'USE TEMP B-TREE FOR ORDER BY', selectID: 5, parentID: 0 },
  ];
  const natural: any[] = [{ ...loop }];
  const scan = (index: number, op: number, flags: number) => {
    const node = (flags ? complex : natural)[index];
    if (!node) return undefined;
    return node[({ 1: 'raw', 2: 'name', 3: 'explain', 4: 'selectID', 5: 'parentID' } as any)[op]];
  };
  return { complex, natural, scan };
}
function provenance(snapshot: any) {
  return {
    kind: 'statement',
    protocol: SCAN_STATUS_PROTOCOL,
    runtimeID: '00000000-0000-4000-8000-000000000001',
    sdkVersion: '1.10.0',
    driverVersion: '0.1.0',
    nodeVersion: 'v24.18.0',
    tableSourceSHA256: 'a'.repeat(64),
    pid: 1,
    statementID: 0,
    epoch: 0,
    sql: 'sql',
    ...snapshot,
  };
}
describe('SQLite plan visit measurement', () => {
  it('excludes only unavailable non-loop sentinels while retaining actual sort work', () => {
    const snapshot = captureScanStatus(fixture().scan, constants);
    expect(snapshot.rawTotal).toBe(5);
    expect(snapshot.total).toBe(6);
    expect(snapshot.nodes[0]).toMatchObject({
      rawVisits: -1,
      correctedVisits: 0,
      name: null,
      nativeNameType: 'undefined',
    });
    expect(snapshot.nodes[2]).toMatchObject({ rawVisits: 3, correctedVisits: 3 });
    expect(() =>
      validateScanStatus(
        [provenance(snapshot)],
        { t: { sql: 6 } },
        { sql: snapshot.nodes.map((node: any) => node.explain) }
      )
    ).not.toThrow();
  });
  it.each([null, '', '0', NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unavailable or invalid real loop visits %s',
    value => {
      const input = fixture();
      input.natural[0].raw = value;
      expect(() => captureScanStatus(input.scan, constants)).toThrow();
    }
  );
  it.each(['name', 'explain', 'selectID', 'parentID', 'raw'])(
    'rejects correspondence mismatch in %s',
    field => {
      const input = fixture();
      input.natural[0][field] = field === 'raw' ? 4 : field.endsWith('ID') ? 3 : 'different';
      expect(() => captureScanStatus(input.scan, constants)).toThrow('correspondence');
    }
  );
  it('matches duplicate names by ordered complete identity', () => {
    const input = fixture();
    input.complex.push({ ...input.complex[1], selectID: 8 });
    input.natural.push({ ...input.natural[0], selectID: 8 });
    expect(captureScanStatus(input.scan, constants).total).toBe(9);
    input.natural.reverse();
    expect(() => captureScanStatus(input.scan, constants)).toThrow('correspondence');
  });
  it.each([null, '', '0', -2])('rejects malformed unnamed telemetry %s', value => {
    const input = fixture();
    input.complex[0].raw = value;
    expect(() => captureScanStatus(input.scan, constants)).toThrow();
  });
  it.each(['explain', 'selectID', 'parentID'])('requires valid non-loop identity %s', field => {
    const input = fixture();
    input.complex[0][field] = null;
    expect(() => captureScanStatus(input.scan, constants)).toThrow('identity');
  });
  it('clears the snapshot on each native reset and leaves EXPLAIN intact', () => {
    const input = fixture(),
      records: any[] = [];
    let resets = 0;
    const statement: any = {
      source: 'sql',
      scanStatusV2: input.scan,
      scanStatusReset() {
        resets++;
      },
    };
    instrumentStatement(statement, constants, (record: any) => records.push(record));
    expect(statement.scanStatusV2(0, 1, 1)).toBe(0);
    expect(statement.scanStatusV2(2, 3, 1)).toBe('USE TEMP B-TREE FOR ORDER BY');
    statement.scanStatusReset();
    input.natural[0].raw = input.complex[1].raw = 4;
    expect(statement.scanStatusV2(1, 1, 1)).toBe(4);
    statement.scanStatusReset();
    expect(records.map(record => [record.epoch, record.total])).toEqual([
      [0, 6],
      [1, 7],
    ]);
    expect(resets).toBe(2);
  });
  it.each(['correctedVisits', 'rawVisits', 'selectID', 'loopIndex'])(
    'rejects altered raw artifact field %s',
    field => {
      const snapshot = captureScanStatus(fixture().scan, constants);
      (snapshot.nodes[1] as Record<string, unknown>)[field] = 99;
      expect(() =>
        validateScanStatus(
          [provenance(snapshot)],
          { t: { sql: 6 } },
          { sql: snapshot.nodes.map((node: any) => node.explain) }
        )
      ).toThrow();
    }
  );
  it('rejects duplicate executions, missing zero-row execution and changed totals', () => {
    const snapshot = captureScanStatus(fixture().scan, constants),
      record = provenance(snapshot),
      sqlite = { sql: snapshot.nodes.map((node: any) => node.explain) };
    expect(() => validateScanStatus([record, record], { t: { sql: 12 } }, sqlite)).toThrow(
      'Duplicate'
    );
    expect(() => validateScanStatus([], { t: { sql: 0 } }, { sql: [] })).toThrow('Missing');
    expect(() => validateScanStatus([record], { t: { sql: 5 } }, sqlite)).toThrow(
      'aggregate mismatch'
    );
  });
});
