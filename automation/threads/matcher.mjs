export function shortcode(url) {
  try { return new URL(url).pathname.match(/\/post\/([^/]+)/)?.[1] ?? null; } catch { return null; }
}
export function day(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function alreadyLogged(post, entries) {
  const code = shortcode(post.permalink);
  return entries.some(e => e.postId === post.id || (code && (e.shortcode === code || shortcode(e.postUrl) === code)));
}
export function matches(post, config, now = Date.now()) {
  if (!post.id || !shortcode(post.permalink) || post.is_reply !== false || post.is_quote_post !== false) return false;
  if (post.username?.toLowerCase() === config.username) return false;
  const age = now - Date.parse(post.timestamp);
  if (!Number.isFinite(age) || age < 0 || age > config.maxAgeHours * 3600000) return false;
  const text = (post.text ?? '').toLowerCase();
  // Narrow, explicit invitations only. Any possible restrictions go to manual review.
  const invitation = /\b(?:drop|share|post|show)\s+(?:(?:me|us)\s+)?(?:your|the)\s+(?:(?:digital|side|latest|new)\s+)?(?:products?|projects?|websites?|sites?|apps?|business(?:es)?|links?)\b/.test(text);
  const restricted = /\b(?:only|no|not|don't|dont|do not|must|unless|except|without|free|women|girls|men|boys|local|physical|handmade|follow|repost|dm|comment.{0,12}(?:word|keyword))\b/.test(text);
  const tag = (post.topic_tag ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const relevant = config.communities.includes(tag) || /\b(?:tech|technology|design|ui|ux|websites?|sites?|apps?|software|saas|builders?|building|entrepreneur(?:ship|s)?|digital products?|startups?|coding)\b/.test(text);
  return invitation && relevant && !restricted;
}
