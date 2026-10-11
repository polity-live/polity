import { discoverQueries, loadCases } from './catalog';
console.info(
  JSON.stringify({ registeredQueries: discoverQueries().size, cases: loadCases().length })
);
