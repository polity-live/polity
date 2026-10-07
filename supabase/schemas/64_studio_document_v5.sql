alter table public.studio_project
  alter column document_schema_version set default 5;

alter table public.studio_project
  drop constraint if exists studio_project_document_schema_version_check;

alter table public.studio_project
  add constraint studio_project_document_schema_version_check
  check (document_schema_version in (2, 3, 4, 5));
