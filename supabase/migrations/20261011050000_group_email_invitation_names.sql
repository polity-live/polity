-- Optional invitation labels; never used as authenticated profile identity.
ALTER TABLE group_invitations.group_email_invitation
  ADD COLUMN first_name TEXT CHECK (first_name IS NULL OR (first_name = btrim(first_name) AND char_length(first_name) BETWEEN 1 AND 100)),
  ADD COLUMN last_name TEXT CHECK (last_name IS NULL OR (last_name = btrim(last_name) AND char_length(last_name) BETWEEN 1 AND 100));
