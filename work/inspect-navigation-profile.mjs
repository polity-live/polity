import { readFileSync } from 'node:fs';
const profile = JSON.parse(readFileSync('output/zero-performance/canonical-journeys-v6-1/workers/journeys/navigation.cpuprofile', 'utf8'));
const nodes = new Map(profile.nodes.map(node => [node.id, node]));
const parents = new Map();
for (const node of profile.nodes) for (const id of node.children ?? []) parents.set(id, node.id);
const durations = new Map();
for (let i = 0; i < profile.samples.length; i++) durations.set(profile.samples[i], (durations.get(profile.samples[i]) ?? 0) + profile.timeDeltas[i] / 1000);
const frame = node => ({ name: node.callFrame.functionName, file: node.callFrame.url.split('/').at(-1), line: node.callFrame.lineNumber + 1, column: node.callFrame.columnNumber + 1 });
const top = [...durations].sort((a, b) => b[1] - a[1]).filter(([id]) => !['(idle)', '(program)'].includes(nodes.get(id).callFrame.functionName)).slice(0, 20).map(([id, ms]) => {
  const stack = []; let parent = parents.get(id);
  for (let i = 0; parent && i < 5; i++, parent = parents.get(parent)) stack.push(frame(nodes.get(parent)));
  return { ms, ...frame(nodes.get(id)), stack };
});
console.log(JSON.stringify(top, null, 2));
