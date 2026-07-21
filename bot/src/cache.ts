// In-memory file_id cache — resend previously seen videos instantly
// file_id is Telegram's cached reference; resending takes ~100ms vs 2-5s

const cache = new Map<string, string>(); // normalizedUrl → file_id

function normalize(url: string): string {
  try {
    const u = new URL(url);
    // Strip common tracking params that don't change the video
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term",
     "_r","_d","share_app_id","share_link_id","social_author_id","is_copy_url",
     "is_from_webapp","sender_device","sender_web_id","referer_url","referer_video_id",
    ].forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

export function getCached(url: string): string | undefined {
  return cache.get(normalize(url));
}

export function setCached(url: string, fileId: string): void {
  cache.set(normalize(url), fileId);
  // Keep cache bounded to 500 entries
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
}
