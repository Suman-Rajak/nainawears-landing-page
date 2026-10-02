/**
 * image.js
 * Serves remote images (Imgbb, Unsplash, ...) through the wsrv.nl image CDN,
 * which resizes them to the displayed size, converts to WebP and caches them
 * at the edge. Cuts ~150–250KB originals down to ~25KB.
 */
export function optimizeImage(url, width) {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=75`;
}
