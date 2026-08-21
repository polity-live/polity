-- =============================================================================
-- 23_storage.sql — Storage RLS policies
-- Buckets are defined in config.toml and provisioned via: pnpm exec supabase seed buckets
-- =============================================================================

-- ── Avatars bucket policies ─────────────────────────────────────────

-- Anyone can read avatars (public bucket)
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar (path = <user_id>/*)
CREATE POLICY "avatars_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update their own avatar
CREATE POLICY "avatars_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own avatar
CREATE POLICY "avatars_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Uploads bucket policies ─────────────────────────────────────────

-- Anyone can read uploads (public bucket)
CREATE POLICY "uploads_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'uploads');

-- Authenticated users can upload files
CREATE POLICY "uploads_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'uploads');

-- Authenticated users can update their own uploads
CREATE POLICY "uploads_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'uploads');

-- Authenticated users can delete uploads
CREATE POLICY "uploads_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'uploads');

-- service_role has full access (used by server-side operations)
CREATE POLICY "service_role_all_storage"
  ON storage.objects FOR ALL
  TO service_role
  USING (true);

-- Dataset snapshots are private. The application server authorizes dataset
-- metadata access and reads objects with the service role only.
CREATE POLICY "dataset_snapshots_no_direct_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "dataset_snapshots_no_direct_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (false);
