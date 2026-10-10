globalThis.TESTING = false;
const { buildQuery, loadCases, OWNER } = await import('../tools/e2e/zero-performance/catalog.ts');
for (const name of ['events.delegateAssemblyComposition', 'elections.electorsByElection']) {
  const ast = buildQuery(loadCases().find(entry => entry.name === name && entry.variant === 'default'), OWNER).ast;
  const pending = [];
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'correlatedSubquery' && node.flip !== false)
      pending.push({ path, keys: Object.keys(node), flip: node.flip, table: node.related?.subquery?.table });
    for (const [key, value] of Object.entries(node)) visit(value, `${path}.${key}`);
  };
  visit(ast, name);
  console.log(JSON.stringify({ name, pending }, null, 2));
}
