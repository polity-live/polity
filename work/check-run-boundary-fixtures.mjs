import postgres from 'postgres';
const sql = postgres('postgresql://postgres:postgres@127.0.0.1:54322/postgres', {
  max: 1,
  prepare: false,
  onnotice: () => {
    /* This fixture diagnostic omits PostgreSQL notices. */
  },
});
try {
  const counts = await sql.unsafe(`
    select 'run_boundary_amendments' as fixture, count(*)::int as remaining
      from public.amendment where title='Run boundaries'
    union all select 'run_boundary_studio',count(*)::int
      from public.studio_project where title='Run boundaries'
    union all select 'run_boundary_conversations',count(*)::int
      from public.conversation where name='Run boundaries'
  `);
  console.log(JSON.stringify(counts));
  const assistant = await sql.unsafe(
    "select created_at < timestamp with time zone '2026-10-09 14:56:13+00' as existed_before_run from public.\"user\" where id='a12a0000-0000-4000-a000-000000000001'"
  );
  console.log(JSON.stringify({ assistant: assistant.map(row => row.existed_before_run) }));
} finally {
  await sql.end({ timeout: 5 });
}
