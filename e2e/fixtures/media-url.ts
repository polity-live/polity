export function mediaUrl(prefix: string, kind: 'image' | 'video' = 'image') {
  const slug = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const extension = kind === 'video' ? 'mp4' : 'png';
  return `https://example.test/e2e-media/${slug}.${extension}`;
}
