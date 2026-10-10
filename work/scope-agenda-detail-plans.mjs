import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const file = 'src/zero/events/queries.ts';
const source = (await readFile(file, 'utf8')).replaceAll('\r\n', '\n');
const start = source.indexOf('  agendaItemDetail: defineQuery(');
const end = source.indexOf('  /** Event with delegates', start);
assert.ok(start >= 0 && end > start);
let scoped = source.slice(start, end);
const election = ".whereExists('election', election =>\n                applyElectionManagerQueryAccess(election, userID)\n              )";
assert.equal(scoped.split(election).length, 4);
scoped = scoped.replaceAll(
  election,
  ".whereExists(\n                'election',\n                election => applyElectionManagerQueryAccess(election, userID),\n                { flip: false }\n              )"
);
const vote = ".whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))";
assert.equal(scoped.split(vote).length, 4);
scoped = scoped.replaceAll(
  vote,
  ".whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID), {\n                flip: false,\n              })"
);
await writeFile(file, source.slice(0, start) + scoped + source.slice(end));
