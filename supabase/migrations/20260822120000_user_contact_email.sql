alter table public."user"
  add column if not exists contact_email text;
