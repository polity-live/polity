import { table, string, number, boolean, json } from '@rocicorp/zero';
import type { MutableJSONValue } from '../shared/helpers';

export const user = table('user')
  .columns({
    id: string(),
    email: string().optional(),
    contact_email: string().optional(),
    handle: string().optional(),
    first_name: string().optional(),
    last_name: string().optional(),
    bio: string().optional(),
    gender: string().optional(),
    about: json<MutableJSONValue>().optional(),
    avatar: string().optional(),
    video_url: string().optional(),
    x: string().optional(),
    youtube: string().optional(),
    linkedin: string().optional(),
    website: string().optional(),
    whatsapp: string().optional(),
    instagram: string().optional(),
    twitter: string().optional(),
    facebook: string().optional(),
    snapchat: string().optional(),
    tiktok: string().optional(),
    country: string().optional(),
    region: string().optional(),
    post_code: string().optional(),
    city: string().optional(),
    street: string().optional(),
    house_number: string().optional(),
    latitude: number().optional(),
    longitude: number().optional(),
    location_kind: string().optional(),
    location_place_id: string().optional(),
    location_boundary_source: string().optional(),
    location_geometry: json<MutableJSONValue>().optional(),
    location_bounds: json<MutableJSONValue>().optional(),
    visibility: string(),
    subscriber_count: number(),
    amendment_count: number(),
    group_count: number(),
    tutorial_step: number().optional(),
    assistant_introduction: boolean().optional(),
    tutorial_run_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const file = table('file')
  .columns({
    id: string(),
    path: string().optional(),
    url: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');
