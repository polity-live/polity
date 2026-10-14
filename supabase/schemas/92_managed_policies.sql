-- 92_managed_policies.sql: canonical current definitions; historical upgrades are not replayed.

CREATE POLICY studio_direct_presence_read ON realtime.messages FOR SELECT TO authenticated USING (public.studio_presence_channel_access(realtime.topic()));

CREATE POLICY studio_direct_presence_write ON realtime.messages FOR INSERT TO authenticated WITH CHECK (public.studio_presence_channel_access(realtime.topic()));

CREATE POLICY avatars_auth_delete ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY avatars_auth_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY avatars_auth_update ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY avatars_public_read ON storage.objects FOR SELECT USING ((bucket_id = 'avatars'::text));

CREATE POLICY dataset_snapshots_no_direct_read ON storage.objects FOR SELECT TO authenticated USING (false);

CREATE POLICY dataset_snapshots_no_direct_write ON storage.objects FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY service_role_all_storage ON storage.objects TO service_role USING (true);

CREATE POLICY uploads_auth_delete ON storage.objects FOR DELETE TO authenticated USING ((bucket_id = 'uploads'::text));

CREATE POLICY uploads_auth_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'uploads'::text));

CREATE POLICY uploads_auth_update ON storage.objects FOR UPDATE TO authenticated USING ((bucket_id = 'uploads'::text));

CREATE POLICY uploads_public_read ON storage.objects FOR SELECT USING ((bucket_id = 'uploads'::text));
