export const SCAN_STATUS_PROTOCOL = 'sqlite-plan-visits-v1';

function visits(value) {
  if (typeof value !== 'number' && typeof value !== 'bigint')
    throw new Error('Unavailable SQLite NVISIT');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0)
    throw new Error('Invalid SQLite natural-loop NVISIT');
  return number;
}

function identity(scan, index, constants, flags) {
  const name = scan(index, constants.SQLITE_SCANSTAT_NAME, flags);
  const explain = scan(index, constants.SQLITE_SCANSTAT_EXPLAIN, flags);
  const selectID = scan(index, constants.SQLITE_SCANSTAT_SELECTID, flags);
  const parentID = scan(index, constants.SQLITE_SCANSTAT_PARENTID, flags);
  if (
    (name != null && (typeof name !== 'string' || name.length === 0)) ||
    typeof explain !== 'string' ||
    explain.length === 0 ||
    typeof selectID !== 'number' ||
    !Number.isSafeInteger(selectID) ||
    selectID < 0 ||
    typeof parentID !== 'number' ||
    !Number.isSafeInteger(parentID) ||
    parentID < 0
  )
    throw new Error('Unavailable SQLite plan-node identity');
  return {
    name: name ?? null,
    nativeNameType: name === null ? 'null' : typeof name,
    explain,
    selectID,
    parentID,
  };
}

/** Read both APIs from the same completed statement, before its counters reset. */
export function captureScanStatus(scan, constants) {
  const nodes = [];
  const loops = [];
  for (let index = 0; ; index++) {
    const raw = scan(index, constants.SQLITE_SCANSTAT_NVISIT, 0);
    if (raw === undefined) break;
    const node = identity(scan, index, constants, 0);
    if (node.name === null) throw new Error('Unnamed SQLite natural loop');
    loops.push({ index, visits: visits(raw), ...node });
  }
  let ordinal = 0;
  for (let index = 0; ; index++) {
    const raw = scan(index, constants.SQLITE_SCANSTAT_NVISIT, constants.SQLITE_SCANSTAT_COMPLEX);
    if (raw === undefined) break;
    const { name, nativeNameType, explain, selectID, parentID } = identity(
      scan,
      index,
      constants,
      constants.SQLITE_SCANSTAT_COMPLEX
    );
    if (typeof raw !== 'number' && typeof raw !== 'bigint')
      throw new Error('Unavailable SQLite complex NVISIT');
    const rawVisits = Number(raw);
    if (!Number.isSafeInteger(rawVisits)) throw new Error('Unavailable SQLite complex NVISIT');
    let loopIndex = null;
    let correctedVisits = 0;
    if (name != null) {
      const loop = loops[ordinal];
      if (
        !loop ||
        loop.name !== name ||
        loop.explain !== explain ||
        loop.selectID !== selectID ||
        loop.parentID !== parentID ||
        loop.visits !== rawVisits
      )
        throw new Error('SQLite complex/natural-loop correspondence mismatch');
      loopIndex = ordinal++;
      correctedVisits = loop.visits;
    } else if (rawVisits !== -1) {
      // Sort/materialization nodes can have real visits even though flags=0 excludes them.
      // Retain that work. Only SQLite's exact unavailable -1 sentinel is bookkeeping.
      correctedVisits = visits(raw);
    }
    nodes.push({
      index,
      name,
      nativeNameType,
      explain,
      selectID,
      parentID,
      rawVisits,
      loopIndex,
      correctedVisits,
    });
  }
  if (ordinal !== loops.length)
    throw new Error('Missing SQLite complex/natural-loop correspondence');
  const rawTotal = nodes.reduce((sum, node) => sum + node.rawVisits, 0);
  const total = nodes.reduce((sum, node) => sum + node.correctedVisits, 0);
  if (!Number.isSafeInteger(rawTotal) || !Number.isSafeInteger(total))
    throw new Error('Unsafe SQLite visit aggregate');
  return { nodes, loops, rawTotal, total };
}

/** Only the SDK's COMPLEX NVISIT request changes. Full EXPLAIN plans remain intact. */
export function instrumentStatement(statement, constants, record) {
  const originalScan = statement.scanStatusV2.bind(statement);
  const originalReset = statement.scanStatusReset.bind(statement);
  let snapshot;
  let epoch = 0;
  statement.scanStatusV2 = function (index, op, flags = 0) {
    if (op !== constants.SQLITE_SCANSTAT_NVISIT || flags !== constants.SQLITE_SCANSTAT_COMPLEX)
      return originalScan(index, op, flags);
    if (!Number.isSafeInteger(index) || index < 0)
      throw new Error('Invalid SQLite scan-status index');
    snapshot ??= captureScanStatus(originalScan, constants);
    return snapshot.nodes[index]?.correctedVisits;
  };
  statement.scanStatusReset = function () {
    if (snapshot)
      record({ protocol: SCAN_STATUS_PROTOCOL, sql: statement.source, epoch, ...snapshot });
    originalReset();
    snapshot = undefined;
    epoch++;
  };
  return statement;
}
